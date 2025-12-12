"use server";
import { revalidatePath } from "next/cache";

import { prisma } from '@/lib/prisma';
import { Client, Facture, Devis, Produit, User } from '@/types';

// --- Authentication & User Management ---

export async function registerUser(data: any) {
    try {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) return { success: false, error: "Cet email est déjà utilisé" };

        const user = await prisma.user.create({
            data: {
                email: data.email,
                fullName: data.fullName,
                password: data.password, // In PROD: Hash this!
                role: data.role || "user",
                societes: {
                    connect: data.societes?.map((id: string) => ({ id })) || []
                }
            },
            include: { societes: true }
        });

        return { success: true, user: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function loginUser(email: string, password: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { societes: true }
        });

        if (!user || user.password !== password) { // In PROD: Use bcrypt.compare
            return { success: false, error: "Email ou mot de passe incorrect" };
        }

        return { success: true, user: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateUser(userData: any) {
    try {
        const user = await prisma.user.update({
            where: { id: userData.id },
            data: {
                email: userData.email,
                fullName: userData.fullName,
                password: userData.password,
                role: userData.role
                // Societes update logic requires disconnect/connect, skipping for simple update
            },
            include: { societes: true }
        });
        return { success: true, user: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function upsertUser(userData: any) {
    try {
        // Enforce DB constraints via Prisma Upsert
        // If id matches, Update. If not, Create.
        // We match on ID primarily. 

        const user = await prisma.user.upsert({
            where: { id: userData.id || "new_user" }, // Fallback to avoid error, but usage should provide ID
            update: {
                email: userData.email,
                fullName: userData.fullName,
                password: userData.password,
                role: userData.role
            },
            create: {
                id: userData.id, // Explicit ID allowed (e.g. usr_1)
                email: userData.email,
                fullName: userData.fullName,
                password: userData.password,
                role: userData.role || "user",
                societes: {
                    connect: userData.societes?.map((id: string) => ({ id })) || []
                }
            },
            include: { societes: true }
        });

        // Ensure we always return the fresh DB state
        return { success: true, user: mapUser(user) };
    } catch (error: any) {
        console.error("Upsert User Failed:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchAllUsers() {
    try {
        const users = await prisma.user.findMany({ include: { societes: true } });
        return { success: true, data: users.map(mapUser) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchUserById(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { societes: true }
        });
        if (!user) return { success: false, error: "Utilisateur introuvable" };
        return { success: true, data: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

function mapUser(prismaUser: any): User {
    return {
        id: prismaUser.id,
        email: prismaUser.email,
        fullName: prismaUser.fullName || "",
        role: prismaUser.role as any,
        permissions: [], // Default or stored in DB
        societes: prismaUser.societes.map((s: any) => s.id),
        currentSocieteId: prismaUser.currentSocieteId || prismaUser.societes[0]?.id,
        lastReadHistory: prismaUser.lastReadHistory ? prismaUser.lastReadHistory.toISOString() : undefined,
        password: prismaUser.password // Returning password to client is BAD practice in real app, but needed for current Local Logic to pre-fill
    };
}

export async function markHistoryAsRead(userId: string) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { lastReadHistory: new Date() }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Connection Check ---

export async function checkDatabaseConnection() {
    console.log("Checking Database connection...");
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { success: true, message: "Connexion Base de Données (Prisma) OK !" };
    } catch (error: any) {
        console.error("Database Connection Error:", error);
        return { success: false, message: `Erreur de connexion : ${error.message}` };
    }
}

// --- Helper to Auto-Create Products ---

async function ensureProductsExist(items: any[], societeId: string) {
    if (!items || !Array.isArray(items)) return items;

    const updatedItems = [];
    for (const item of items) {
        // Only process items that have a description but NO produitId
        // And are not specifically "text" type if we differentiate? 
        // InvoiceLineItem uses type='texte' for free text, we might want to skip those if user intended them as just text.
        // But user said "all products added... must be created".
        // Let's assume if it has a price > 0 or if it looks like a product, we create it.
        // Actually, if it has no produitId, we check if we should create it.
        // Simple rule: If it has description and (price or quantity), treat as potential product.

        if (item) {
            // Calculate line total (HT after discount)
            const qty = typeof item.quantite === 'number' ? item.quantite : parseFloat(item.quantite) || 0;
            const price = typeof item.prixUnitaire === 'number' ? item.prixUnitaire : parseFloat(item.prixUnitaire) || 0;
            let total = qty * price;

            // Apply discount if present
            const remise = typeof item.remise === 'number' ? item.remise : parseFloat(item.remise) || 0;
            if (remise > 0) {
                if (item.remiseType === 'montant') {
                    total = Math.max(0, total - remise);
                } else {
                    total = total * (1 - remise / 100);
                }
            }

            // Explicitly set calculated property
            item.totalLigne = total;
        }

        if (!item.produitId && item.description && item.description.trim() !== "") {
            // Check if product exists by name in this societe
            const existingProduct = await prisma.produit.findFirst({
                where: {
                    societeId: societeId,
                    nom: item.description.trim()
                }
            });

            if (existingProduct) {
                updatedItems.push({
                    ...item,
                    produitId: existingProduct.id
                });
            } else {
                // Create new product
                try {
                    const newProduct = await prisma.produit.create({
                        data: {
                            nom: item.description.trim(),
                            societeId: societeId,
                            prixUnitaire: typeof item.prixUnitaire === 'number' ? item.prixUnitaire : parseFloat(item.prixUnitaire) || 0,
                            tva: typeof item.tva === 'number' ? item.tva : parseFloat(item.tva) || 0,
                            description: "" // Optional
                        }
                    });
                    updatedItems.push({
                        ...item,
                        produitId: newProduct.id
                    });
                } catch (e) {
                    console.error("Failed to auto-create product:", e);
                    updatedItems.push(item); // Keep as is if failure
                }
            }
        } else {
            updatedItems.push(item);
        }
    }
    return updatedItems;
}

// --- Fetch Actions ---

export interface ActionState<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    fieldErrors?: Record<string, string>;
    id?: string; // For create actions
}

function handleActionError(error: any): ActionState {
    console.error("Server Action Error:", error);

    // Prisma Unique Constraint Error
    if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'Unknown';
        return {
            success: false,
            error: `La valeur pour ${field} existe déjà.`
        };
    }

    // Generic fallback
    return {
        success: false,
        error: "Une erreur technique est survenue. Veuillez réessayer."
    };
}

export async function fetchSocietes(): Promise<{ success: boolean, data?: any[], error?: string }> {
    try {
        const societes = await prisma.societe.findMany();
        return { success: true, data: societes };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSociete(id: string) {
    try {
        const societe = await prisma.societe.findUnique({ where: { id } });
        if (!societe) return { success: false, error: "Société introuvable" };
        return { success: true, data: societe };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createSociete(nom: string) {
    try {
        const societe = await prisma.societe.create({
            data: { nom }
        });
        return { success: true, data: societe };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSociete(societe: any) {
    if (!societe.id) return { success: false, error: "ID manquant" };
    try {
        const { id, ...data } = societe;
        // Clean undefined/null values if necessary or let Prisma handle it
        await prisma.societe.update({
            where: { id },
            data: data
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchClients(societeId: string): Promise<{ success: boolean, data?: Client[], error?: string }> {
    try {
        const clients = await prisma.client.findMany({
            where: { societeId },
        });

        // Map Prisma result to Client interface
        const mapped: Client[] = clients.map((c: any) => ({
            id: c.id,
            societeId: c.societeId,
            nom: c.nom,
            email: c.email || "",
            telephone: c.telephone || "",
            adresse: c.adresse || "",
            codePostal: c.codePostal || "",
            ville: c.ville || "",
            pays: c.pays || "France",
            siret: c.siret || "",
            tvaIntra: c.tvaIntra || "",
            statut: "Actif",
            totalFactures: 0 // Calculation would need a relation count
        }));

        return { success: true, data: mapped };
    } catch (error: any) {
        console.error("Error fetching Clients:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchInvoices(societeId: string): Promise<{ success: boolean, data?: Facture[], error?: string }> {
    try {
        const invoices = await prisma.facture.findMany({
            // @ts-ignore - deletedAt exists in schema
            where: { societeId, deletedAt: null },
            include: { client: true }, // Fetch client to ensure we have link info if needed
            orderBy: [
                { dateEmission: 'desc' },
                { numero: 'desc' }
            ]
        });



        const mapped: Facture[] = invoices.map((inv: any) => {
            let items = [];
            let emails = [];
            try {
                if (inv.itemsJSON) items = JSON.parse(inv.itemsJSON);
                if (inv.emailsJSON) emails = JSON.parse(inv.emailsJSON);
            } catch (e) {
                console.error("Error parsing JSON fields", e);
            }

            return {
                id: inv.id,
                numero: inv.numero,
                clientId: inv.clientId,
                societeId: inv.societeId,
                dateEmission: inv.dateEmission.toISOString(),
                echeance: inv.dateEcheance ? inv.dateEcheance.toISOString() : "",
                statut: inv.statut as any,
                totalHT: inv.totalHT,
                totalTTC: inv.totalTTC,
                datePaiement: inv.datePaiement ? inv.datePaiement.toISOString() : undefined,
                items: items,
                emails: emails,
                type: "Facture",
                createdAt: inv.createdAt ? inv.createdAt.toISOString() : undefined,
                updatedAt: inv.updatedAt ? inv.updatedAt.toISOString() : undefined
            };
        });
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchQuotes(societeId: string): Promise<{ success: boolean, data?: Devis[], error?: string }> {
    try {
        const quotes = await prisma.devis.findMany({
            // @ts-ignore - deletedAt exists in schema
            where: { societeId, deletedAt: null }
        });

        const mapped: Devis[] = quotes.map((q: any) => {
            let items = [];
            let emails = [];
            try {
                if (q.itemsJSON) items = JSON.parse(q.itemsJSON);
                if (q.emailsJSON) emails = JSON.parse(q.emailsJSON);
            } catch (e) {
                console.error("Error parsing JSON fields", e);
            }

            return {
                id: q.id,
                numero: q.numero,
                clientId: q.clientId,
                societeId: q.societeId,
                dateEmission: q.dateEmission.toISOString(),
                dateValidite: q.dateValidite ? q.dateValidite.toISOString() : "",
                statut: q.statut as any,
                totalHT: q.totalHT,
                totalTTC: q.totalTTC,
                items: items,
                emails: emails,
                type: "Devis",
                createdAt: q.createdAt ? q.createdAt.toISOString() : undefined,
                updatedAt: q.updatedAt ? q.updatedAt.toISOString() : undefined
            };
        });
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchProducts(societeId: string): Promise<{ success: boolean, data?: Produit[], error?: string }> {
    try {
        const products = await prisma.produit.findMany({
            where: { societeId }
        });

        const mapped: Produit[] = products.map((p: any) => ({
            id: p.id,
            societeId: p.societeId,
            nom: p.nom,
            description: p.description || "",
            prixUnitaire: p.prixUnitaire,
            tva: p.tva
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Delete Actions ---

export async function deleteAllRecords(tableName: string) {
    try {
        let count = 0;
        switch (tableName) {
            case 'Clients':
                count = (await prisma.client.deleteMany()).count;
                break;
            case 'Produits':
                count = (await prisma.produit.deleteMany()).count;
                break;
            case 'Factures':
                count = (await prisma.facture.deleteMany()).count;
                break;
            case 'Devis':
                count = (await prisma.devis.deleteMany()).count;
                break;
            default:
                throw new Error("Table inconnue");
        }
        return { success: true, count };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- History / Audit Log Actions ---

export async function createHistoryEntry(entry: {
    userId: string;
    action: string;
    entityType: string;
    description: string;
    entityId?: string;
    societeId?: string;
}) {
    // Basic validation
    if (!entry.userId || !entry.action || !entry.description) {
        return { success: false, error: "Champs requis manquants pour l'historique" };
    }

    try {
        await prisma.historyEntry.create({
            data: {
                userId: entry.userId,
                action: entry.action,
                entityType: entry.entityType,
                description: entry.description,
                entityId: entry.entityId,
                societeId: entry.societeId
            }
        });
        // We don't necessarily need to revalidate path for history as it's often pulled client-side or on specific pages,
        // but if RecentActivity is server component, we might.
        // revalidatePath("/"); 
        return { success: true };
    } catch (error: any) {
        console.error("Failed to create history entry:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchHistory(limit: number = 50, societeId?: string) {
    try {
        const whereClause = societeId ? { societeId } : {};

        const history = await prisma.historyEntry.findMany({
            where: whereClause,
            take: limit,
            orderBy: { timestamp: 'desc' },
            select: {
                id: true,
                userId: true,
                action: true,
                entityType: true,
                entityId: true,
                description: true,
                timestamp: true,
                user: { select: { fullName: true } }
            }
        });

        const mapped = history.map((h: any) => ({
            id: h.id,
            userId: h.userId,
            userName: h.user?.fullName || "Utilisateur Inconnu",
            action: h.action,
            entityType: h.entityType,
            entityId: h.entityId,
            description: h.description,
            timestamp: h.timestamp.toISOString()
        }));

        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function deleteRecord(tableName: string, recordId: string) {
    if (!recordId) return { success: false, error: "Missing ID" };

    try {
        switch (tableName) {
            case 'Clients':
                await prisma.client.delete({ where: { id: recordId } });
                break;
            case 'Produits':
                await prisma.produit.delete({ where: { id: recordId } });
                break;
            case 'Factures':
                await prisma.facture.update({
                    where: { id: recordId },
                    // @ts-ignore
                    data: { deletedAt: new Date() }
                });
                break;
            case 'Devis':
                await prisma.devis.update({
                    where: { id: recordId },
                    // @ts-ignore
                    data: { deletedAt: new Date() }
                });
                break;
            case 'Societe':
                // Cascade delete should be handled by DB or explicit deletion of relations
                // For now, let's delete the society. Prisma might complain if relations exist.
                // We should delete relations first if not cascading. 
                // Assuming Schema has cascade delete or we do it here.
                await prisma.client.deleteMany({ where: { societeId: recordId } });
                await prisma.produit.deleteMany({ where: { societeId: recordId } });
                await prisma.facture.deleteMany({ where: { societeId: recordId } });
                await prisma.devis.deleteMany({ where: { societeId: recordId } });
                await prisma.societe.delete({ where: { id: recordId } });
                break;
            default:
                throw new Error("Table inconnue");
        }
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Import/Create/Update Actions ---

export async function createClient(client: Client) {
    try {
        const res = await prisma.client.create({
            data: {
                societeId: client.societeId || "Euromedmultimedia",
                nom: client.nom,
                email: client.email,
                telephone: client.telephone,
                adresse: client.adresse,
                ville: client.ville,
                codePostal: client.codePostal,
                pays: client.pays,
                siret: client.siret,
                tvaIntra: client.tvaIntra
            }
        });
        return { success: true, id: res.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateClient(client: Client) {
    if (!client.id) return { success: false, error: "ID manquant" };
    try {
        await prisma.client.update({
            where: { id: client.id },
            data: {
                nom: client.nom,
                email: client.email,
                telephone: client.telephone,
                adresse: client.adresse,
                ville: client.ville,
                codePostal: client.codePostal,
                pays: client.pays,
                siret: client.siret,
                tvaIntra: client.tvaIntra
                // Not updating societeId usually
            }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createProduct(product: Produit) {
    try {
        const res = await prisma.produit.create({
            data: {
                societeId: product.societeId || "Euromedmultimedia",
                nom: product.nom,
                prixUnitaire: product.prixUnitaire,
                tva: product.tva,
                description: product.description
            }
        });
        return { success: true, id: res.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateProduct(product: Produit) {
    if (!product.id) return { success: false, error: "ID manquant" };
    try {
        await prisma.produit.update({
            where: { id: product.id },
            data: {
                nom: product.nom,
                prixUnitaire: product.prixUnitaire,
                tva: product.tva,
                description: product.description
            }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createInvoice(invoice: Facture) {
    try {
        const societeId = invoice.societeId || "Euromedmultimedia";
        const processedItems = await ensureProductsExist(invoice.items || [], societeId);
        const itemsJson = JSON.stringify(processedItems);

        // Ensure clientId exists
        if (!invoice.clientId) throw new Error("Client requis");

        const res = await prisma.facture.create({
            data: {
                numero: invoice.numero,
                dateEmission: new Date(invoice.dateEmission),
                statut: invoice.statut,
                totalHT: invoice.totalHT,
                totalTTC: invoice.totalTTC,
                dateEcheance: invoice.echeance ? new Date(invoice.echeance) : null,
                itemsJSON: itemsJson,
                emailsJSON: JSON.stringify(invoice.emails || []),
                societeId: societeId,
                clientId: invoice.clientId
            }
        });
        revalidatePath("/", "layout");
        return { success: true, id: res.id };
    } catch (error: any) {
        return handleActionError(error);
    }
}

export async function updateInvoice(invoice: Facture) {
    if (!invoice.id) return { success: false, error: "ID manquant" };
    try {
        // Need to fetch current invoice or rely on passed societeId?
        // Passed invoice *should* have societeId. If not, we might fallback or query.
        // Let's safe query if missing.
        let societeId = invoice.societeId;
        if (!societeId) {
            const existing = await prisma.facture.findUnique({ where: { id: invoice.id }, select: { societeId: true } });
            societeId = existing?.societeId || "Euromedmultimedia";
        }

        const processedItems = await ensureProductsExist(invoice.items || [], societeId);
        const itemsJson = JSON.stringify(processedItems);
        const emailsJson = JSON.stringify(invoice.emails || []);

        await prisma.facture.update({
            where: { id: invoice.id },
            data: {
                numero: invoice.numero,
                dateEmission: new Date(invoice.dateEmission),
                statut: invoice.statut,
                totalHT: invoice.totalHT,
                totalTTC: invoice.totalTTC,
                dateEcheance: invoice.echeance ? new Date(invoice.echeance) : null,
                // Enforce: If status is not Payée, remove payment date
                datePaiement: (invoice.statut === 'Payée' && invoice.datePaiement) ? new Date(invoice.datePaiement) : null,
                itemsJSON: itemsJson,
                emailsJSON: emailsJson,
                clientId: invoice.clientId
            }
        });
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return handleActionError(error);
    }
}

export async function createQuote(quote: Devis) {
    try {
        if (!quote.clientId) throw new Error("Client requis");
        const societeId = quote.societeId || "Euromedmultimedia";
        const processedItems = await ensureProductsExist(quote.items || [], societeId);
        const itemsJson = JSON.stringify(processedItems);

        const res = await prisma.devis.create({
            data: {
                numero: quote.numero,
                dateEmission: new Date(quote.dateEmission),
                statut: quote.statut,
                totalHT: quote.totalHT,
                totalTTC: quote.totalTTC,
                dateValidite: quote.dateValidite ? new Date(quote.dateValidite) : null,
                itemsJSON: itemsJson,
                emailsJSON: JSON.stringify(quote.emails || []),
                societeId: societeId,
                clientId: quote.clientId
            }
        });
        revalidatePath("/", "layout");
        return { success: true, id: res.id };
    } catch (error: any) {
        return handleActionError(error);
    }
}

export async function updateQuote(quote: Devis) {
    if (!quote.id) return { success: false, error: "ID manquant" };
    try {
        let societeId = quote.societeId;
        if (!societeId) {
            const existing = await prisma.devis.findUnique({ where: { id: quote.id }, select: { societeId: true } });
            societeId = existing?.societeId || "Euromedmultimedia";
        }

        const processedItems = await ensureProductsExist(quote.items || [], societeId);
        const itemsJson = JSON.stringify(processedItems);

        await prisma.devis.update({
            where: { id: quote.id },
            data: {
                numero: quote.numero,
                dateEmission: new Date(quote.dateEmission),
                statut: quote.statut,
                totalHT: quote.totalHT,
                totalTTC: quote.totalTTC,
                dateValidite: quote.dateValidite ? new Date(quote.dateValidite) : null,

                itemsJSON: itemsJson,
                emailsJSON: JSON.stringify(quote.emails || []),
                clientId: quote.clientId
            }
        });
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return handleActionError(error);
    }
}

// --- Import Helpers (Calls Prisma create) ---
export { createClient as importClient };

export async function importInvoice(invoice: Facture, clientName: string) {
    // Note: Import usually implies we might lack ID. 
    // If clientName is provided but not clientId, we might fail or need lookup.
    // For now, assume invoice has clientId or we fail.
    return createInvoice(invoice);
}

export async function importQuote(quote: Devis, clientName: string) {
    return createQuote(quote);
}

export { createProduct as importProduct };

// --- Trash Actions ---

export async function fetchDeletedInvoices(societeId: string) {
    try {
        const invoices = await prisma.facture.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: { not: null } },
            // @ts-ignore
            orderBy: { deletedAt: 'desc' },
            include: { client: true }
        });
        const mapped = invoices.map((inv: any) => ({
            id: inv.id,
            numero: inv.numero,
            clientId: inv.clientId,
            client: inv.client, // Pass client object
            societeId: inv.societeId,
            dateEmission: inv.dateEmission.toISOString(),
            echeance: inv.dateEcheance ? inv.dateEcheance.toISOString() : "",
            statut: inv.statut as any,
            totalHT: inv.totalHT,
            totalTTC: inv.totalTTC,
            datePaiement: inv.datePaiement ? inv.datePaiement.toISOString() : undefined,
            items: inv.itemsJSON ? JSON.parse(inv.itemsJSON) : [],
            type: "Facture",
            createdAt: inv.createdAt.toISOString(),
            updatedAt: inv.updatedAt.toISOString(),
            deletedAt: inv.deletedAt ? inv.deletedAt.toISOString() : null
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchDeletedQuotes(societeId: string) {
    try {
        const quotes = await prisma.devis.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: { not: null } },
            // @ts-ignore
            orderBy: { deletedAt: 'desc' },
            include: { client: true }
        });
        const mapped = quotes.map((q: any) => ({
            id: q.id,
            numero: q.numero,
            clientId: q.clientId,
            client: q.client, // Pass client name if needed on frontend
            societeId: q.societeId,
            dateEmission: q.dateEmission.toISOString(),
            dateValidite: q.dateValidite ? q.dateValidite.toISOString() : "",
            statut: q.statut as any,
            totalHT: q.totalHT,
            totalTTC: q.totalTTC,
            items: q.itemsJSON ? JSON.parse(q.itemsJSON) : [],
            type: "Devis",
            createdAt: q.createdAt.toISOString(),
            updatedAt: q.updatedAt.toISOString(),
            deletedAt: q.deletedAt ? q.deletedAt.toISOString() : null
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function restoreRecord(tableName: 'Factures' | 'Devis', id: string) {
    try {
        if (tableName === 'Factures') {
            await prisma.facture.update({
                where: { id },
                // @ts-ignore
                data: { deletedAt: null }
            });
        } else if (tableName === 'Devis') {
            await prisma.devis.update({
                where: { id },
                // @ts-ignore
                data: { deletedAt: null }
            });
        }
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function permanentlyDeleteRecord(tableName: 'Factures' | 'Devis', id: string) {
    try {
        if (tableName === 'Factures') {
            await prisma.facture.delete({ where: { id } });
        } else if (tableName === 'Devis') {
            await prisma.devis.delete({ where: { id } });
        }
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function convertQuoteToInvoice(quoteId: string) {
    try {
        // 1. Fetch Quote
        const quote = await prisma.devis.findUnique({ where: { id: quoteId } });
        if (!quote) return { success: false, error: "Devis introuvable" };

        // 2. Fetch all invoices to determine next number correctly
        // We need all numbers to find the Max.
        const invoices = await prisma.facture.findMany({
            where: { societeId: quote.societeId },
            select: { numero: true }
        });

        // Logic from generateNextInvoiceNumber: find max 8-digit number and increment
        // Or if empty, start with reasonable default (e.g., current year + 010001)
        const currentYearPrefix = new Date().getFullYear().toString().substring(2); // "25"
        let nextNumber = `${currentYearPrefix}010001`; // Default start: 25010001

        const numericInvoices = invoices
            .map((inv: { numero: string }) => inv.numero)
            .filter((num: string) => /^\d{8}$/.test(num))
            .map((num: string) => parseInt(num, 10))
            .filter((num: number) => !isNaN(num));

        if (numericInvoices.length > 0) {
            const maxNumber = Math.max(...numericInvoices);
            // Ensure we are not jumping years weirdly if maxNumber is old, 
            // but user request implies continuity.
            // If max is 25010001, next is 25010002.
            nextNumber = (maxNumber + 1).toString();
        }

        const itemsJson = quote.itemsJSON || "[]";

        // 3. Create Invoice
        const res = await prisma.facture.create({
            data: {
                numero: nextNumber,
                societeId: quote.societeId,
                clientId: quote.clientId,
                dateEmission: new Date(),
                dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
                statut: "Brouillon",
                itemsJSON: itemsJson,
                totalHT: quote.totalHT,
                totalTTC: quote.totalTTC,
            }
        });

        // 4. Update Quote Status
        await prisma.devis.update({
            where: { id: quoteId },
            data: { statut: "Facturé" }
        });

        revalidatePath("/", "layout");
        return { success: true, newInvoiceId: res.id, newInvoiceNumber: res.numero };
    } catch (error: any) {
        console.error("Conversion Error:", error);
        return { success: false, error: error.message };
    }
}

export async function markInvoiceAsSent(id: string) {
    try {
        const invoice = await prisma.facture.findUnique({ where: { id } });
        // Only update if currently Draft, to avoid protecting manually set statuses if needed?
        // User said "passe la en envoyé", simple instruction. 
        // We probably shouldn't change "Payée" to "Envoyée".
        // So safe check: if status is Brouillon.
        if (invoice && invoice.statut === "Brouillon") {
            await prisma.facture.update({
                where: { id },
                data: { statut: "Envoyée" }
            });
            revalidatePath("/", "layout");
            return { success: true };
        }
        return { success: false, message: "Statut inchangé (non brouillon ou introuvable)" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateOverdueInvoices() {
    try {
        const now = new Date();
        // Update all invoices where due date is passed and not paid/cancelled
        const res = await prisma.facture.updateMany({
            where: {
                dateEcheance: { lt: now }, // Less than Now
                statut: {
                    notIn: ["Payée", "Annulée", "Retard"] // No need to update if already Retard
                }
            },
            data: { statut: "Retard" }
        });
        revalidatePath("/", "layout");
        return { success: true, count: res.count };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateQuoteStatus(id: string, statut: string) {
    try {
        await prisma.devis.update({
            where: { id },
            // @ts-ignore
            data: { statut }
        });
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
