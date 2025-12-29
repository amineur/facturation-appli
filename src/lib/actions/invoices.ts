"use server";

import { prisma } from '@/lib/prisma';
import { Facture } from '@/types';
import { revalidatePath } from "next/cache";
import { ensureProductsExist } from './products';
import { getDefaultUser } from './auth';
import { handleActionError } from './shared';

// Guards
export async function checkInvoiceMutability(id: string) {
    const invoice = await prisma.facture.findUnique({
        where: { id },
        select: { statut: true, archivedAt: true }
    });

    if (!invoice) return { success: false, error: "Facture introuvable" };

    if (invoice.archivedAt) {
        return { success: false, error: "Facture archivée : modification interdite" };
    }

    if (invoice.statut === "Archivée") {
        return { success: false, error: "Facture archivée : modification impossible" };
    }

    if (invoice.statut === "Annulée") {
        return { success: false, error: "Facture annulée : modification impossible" };
    }

    return { success: true };
}

// Fetch Actions

export async function fetchInvoicesLite(societeId: string): Promise<{ success: boolean, data?: Partial<Facture>[], error?: string }> {
    try {
        const startTotal = Date.now();
        console.log('[PERF] fetchInvoicesLite START');

        // Measure Prisma connection time
        const startConnect = Date.now();
        await prisma.$connect();
        const connectTime = Date.now() - startConnect;
        console.log('[PERF] Prisma $connect:', connectTime, 'ms');

        // Measure query time
        const startQuery = Date.now();
        const invoices = await prisma.facture.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: null, statut: { not: 'Archivée' } },
            select: {
                id: true,
                numero: true,
                clientId: true,
                societeId: true,
                dateEmission: true,
                dateEcheance: true,
                datePaiement: true,
                statut: true,
                totalHT: true,
                totalTTC: true,
                createdAt: true,
                updatedAt: true,
                client: {
                    select: { nom: true } // Only fetch client name for list display
                }
            },
            orderBy: [
                { dateEmission: 'desc' },
                { numero: 'desc' }
            ],
            take: 50
        });
        const queryTime = Date.now() - startQuery;
        console.log('[PERF] Prisma query factures:', queryTime, 'ms');
        console.log('[PERF] Factures count:', invoices.length);

        const totalTime = Date.now() - startTotal;
        console.log('[PERF] fetchInvoicesLite TOTAL:', totalTime, 'ms');
        console.log('[PERF] Breakdown - Connect:', connectTime, 'ms | Query:', queryTime, 'ms | Overhead:', (totalTime - connectTime - queryTime), 'ms');

        const mapped = invoices.map((inv: any) => ({
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
            type: "Facture" as const,
            items: [], // Empty for lite version
            emails: [],
            // clientName: inv.client?.nom // Optional optimization if we want to flatten
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchInvoices(societeId: string): Promise<{ success: boolean, data?: Facture[], error?: string }> {
    return fetchInvoicesLegacy(societeId);
}

async function fetchInvoicesLegacy(societeId: string): Promise<{ success: boolean, data?: Facture[], error?: string }> {
    try {
        const invoices = await prisma.facture.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: null, statut: { not: 'Archivée' } },
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            },
            orderBy: [
                { dateEmission: 'desc' },
                { numero: 'desc' }
            ],
            take: 100  // Pagination: limit to 100 most recent invoices
        });

        const mapped: Facture[] = invoices.map((inv: any) => {
            let items = [];
            let emails = [];
            try {
                if (inv.itemsJSON) items = JSON.parse(inv.itemsJSON);
                if (inv.emailsJSON) emails = JSON.parse(inv.emailsJSON);
            } catch (e) {
                console.error("Error parsing JSON fields", e);
                // Fallback to empty arrays on error
                items = [];
                emails = [];
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
                updatedAt: inv.updatedAt ? inv.updatedAt.toISOString() : undefined,
                isLocked: inv.isLocked,
                archivedAt: inv.archivedAt ? inv.archivedAt.toISOString() : undefined,
                config: inv.config ? JSON.parse(inv.config) : {}
            };
        });
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchInvoiceDetails(id: string): Promise<{ success: boolean, data?: Facture, error?: string }> {
    try {
        const inv = await prisma.facture.findUnique({
            where: { id },
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
        });

        if (!inv) return { success: false, error: "Facture introuvable" };

        let items = [];
        let emails = [];
        try {

            if (inv.itemsJSON) items = JSON.parse(inv.itemsJSON);
            if (inv.emailsJSON) emails = JSON.parse(inv.emailsJSON);
        } catch (e) {
            console.error("Error parsing JSON fields", e);
            items = [];
            emails = [];
        }

        const mapped: Facture = {
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
            updatedAt: inv.updatedAt ? inv.updatedAt.toISOString() : undefined,
            isLocked: inv.isLocked,
            archivedAt: inv.archivedAt ? inv.archivedAt.toISOString() : undefined,
            config: (() => {
                if (!inv.config) return {};
                try {
                    const parsed = JSON.parse(inv.config);
                    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                } catch {
                    return {};
                }
            })()
        };
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createInvoice(invoice: Facture) {
    try {
        // 🔒 SECURITY: Verify access
        const userRes = await getDefaultUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const targetSocieteId = invoice.societeId || userRes.data.currentSocieteId;
        if (!targetSocieteId) return { success: false, error: "Société non spécifiée" };
        if (!invoice.clientId) return { success: false, error: "Client requis" };



        // OPTIMIZED: Single transaction for security check + product creation + invoice creation
        const result = await prisma.$transaction(async (tx) => {
            // Security check within transaction
            const hasAccess = await tx.societe.findFirst({
                where: { id: targetSocieteId, members: { some: { id: userRes.data!.id } } }
            });

            if (!hasAccess) throw new Error("Accès refusé");

            // Process products (optimized to avoid N+1)
            const processedItems = await ensureProductsExist(invoice.items || [], targetSocieteId, tx);
            const itemsJson = JSON.stringify(processedItems);

            // Create invoice
            const res = await tx.facture.create({
                data: {
                    numero: invoice.numero,
                    dateEmission: new Date(invoice.dateEmission),
                    statut: invoice.statut,
                    totalHT: invoice.totalHT,
                    totalTTC: invoice.totalTTC,
                    dateEcheance: invoice.echeance ? new Date(invoice.echeance) : null,
                    itemsJSON: itemsJson,
                    emailsJSON: JSON.stringify(invoice.emails || []),
                    societeId: targetSocieteId,
                    clientId: invoice.clientId,

                    config: JSON.stringify(invoice.config || {}),
                    items: {
                        create: processedItems.map((item: any) => ({
                            produitId: item.produitId || undefined,
                            description: item.nom || item.description || "Article",
                            quantite: Number(item.quantite) || 0,
                            prixUnitaire: Number(item.prixUnitaire) || 0,
                            tva: Number(item.tva) || 0,
                            remise: Number(item.remise) || 0,
                            remiseType: item.remiseType || 'pourcentage',
                            montantHT: Number(item.montantHT) || 0
                        }))
                    }
                }
            });

            return res;
        });



        // OPTIMIZATION: Targeted revalidation
        revalidatePath('/factures', 'page');


        return { success: true, id: result.id };
    } catch (error: any) {
        console.error("[SAVE] ERROR", error);
        return handleActionError(error);
    }
}

export async function updateInvoice(invoice: Facture) {
    if (!invoice.id) return { success: false, error: "ID manquant" };
    try {
        // Guard: Check Mutability & Strict Rules

        const mutabilityCheck = await checkInvoiceMutability(invoice.id);


        if (!mutabilityCheck.success) return mutabilityCheck;

        // Fetch current status to enforce rules

        const currentInvoice = await prisma.facture.findUnique({
            where: { id: invoice.id },
            select: { statut: true, archivedAt: true, societeId: true, numero: true }
        });


        if (!currentInvoice) return { success: false, error: "Facture introuvable" };

        // Guard: Immutable Number
        if (currentInvoice.numero && invoice.numero && currentInvoice.numero !== invoice.numero) {
            return { success: false, error: "Le numéro de facture ne peut pas être modifié." };
        }

        // ... Guards logic (same as before) ...
        // Guard: Cancelled is Terminal
        if (currentInvoice.statut === "Annulée") return { success: false, error: "Facture annulée..." };
        if (currentInvoice.statut !== "Brouillon" && invoice.statut === "Brouillon") return { success: false, error: "Impossible repasser Brouillon..." };
        if (invoice.statut === "Envoyée" && currentInvoice.statut !== "Envoyée") return { success: false, error: "Statut Envoyée réservé..." };
        if (invoice.statut === "Téléchargée" && currentInvoice.statut !== "Téléchargée") return { success: false, error: "Statut Téléchargée réservé..." };

        // Prepare Data
        let societeId = invoice.societeId || currentInvoice.societeId || "Euromedmultimedia";


        const processedItems = await ensureProductsExist(invoice.items || [], societeId);


        const itemsJson = JSON.stringify(processedItems);

        let updateData: any = {
            clientId: invoice.clientId,
            numero: invoice.numero,
            dateEmission: new Date(invoice.dateEmission),
            statut: invoice.statut,
            totalHT: invoice.totalHT,
            totalTTC: invoice.totalTTC,
            dateEcheance: invoice.echeance ? new Date(invoice.echeance) : null,
            datePaiement: (invoice.statut === 'Payée' && invoice.datePaiement) ? new Date(invoice.datePaiement) : null,
            itemsJSON: itemsJson,
            config: JSON.stringify(invoice.config || {}),
        };

        // ... Strict Status Rule logic (same) ...
        // FIX: When invoice is Envoyée/Payée, only allow status changes, but preserve items
        if (currentInvoice.statut === "Envoyée" || currentInvoice.statut === "Envoyé" || currentInvoice.statut === "Payée") {
            if (currentInvoice.statut === invoice.statut) return { success: false, error: "Contenu interdit..." };
            if ((currentInvoice.statut === "Envoyée" || currentInvoice.statut === "Envoyé") && !["Payée", "Annulée", "Retard"].includes(invoice.statut)) return { success: false, error: "Transition invalide..." };

            // Only allow status and datePaiement changes, remove other fields
            updateData = {
                statut: invoice.statut,
                datePaiement: (invoice.statut === 'Payée' && invoice.datePaiement) ? new Date(invoice.datePaiement) : undefined,
                // KEEP itemsJSON to preserve line items
                itemsJSON: itemsJson,
            };
            if (currentInvoice.statut === "Payée" && invoice.statut !== "Payée") updateData.datePaiement = null;
        }


        const updatedInvoice = await prisma.facture.update({
            where: { id: invoice.id },
            data: {
                ...updateData,
                ...(updateData.itemsJSON ? {
                    items: {
                        deleteMany: {}, // Wipe old items
                        create: processedItems.map((item: any) => ({
                            produitId: item.produitId || undefined,
                            description: item.nom || item.description || "Article",
                            quantite: Number(item.quantite) || 0,
                            prixUnitaire: Number(item.prixUnitaire) || 0,
                            tva: Number(item.tva) || 0,
                            remise: Number(item.remise) || 0,
                            remiseType: item.remiseType || 'pourcentage',
                            montantHT: Number(item.montantHT) || 0
                        }))
                    }
                } : {})
            },
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
        });



        revalidatePath(`/factures/${invoice.id}`, 'page');
        revalidatePath('/factures', 'page');



        return { success: true, data: updatedInvoice };
    } catch (error: any) {
        console.error("[SAVE] ERROR", error);
        return handleActionError(error);
    }
}

export async function toggleInvoiceLock(invoiceId: string, isLocked: boolean) {
    if (!invoiceId) return { success: false, error: "ID manquant" };
    try {
        // A) Read BEFORE Update (Strict Verification)
        const invoice = await prisma.facture.findUnique({
            where: { id: invoiceId },
            // @ts-ignore
            select: { id: true, statut: true, isLocked: true, deletedAt: true, archivedAt: true }
        });

        // B) Strict Conditions
        if (!invoice) return { success: false, error: "Facture introuvable" };

        // ULTRA-SAFE GUARD: If archivedAt is set, NO MODIFICATION ALLOWED.
        if (invoice.archivedAt) {
            return { success: false, error: "Facture archivée : modification interdite" };
        }

        if (invoice.statut === "Archivée") {
            return { success: false, error: "Facture archivée : modification impossible" };
        }

        if (invoice.statut === "Envoyée" || invoice.statut === "Envoyé") {
            return { success: false, error: "Facture envoyée : verrouillage définitif" };
        }

        await prisma.facture.update({
            where: { id: invoiceId },
            data: { isLocked }
        });
        revalidatePath('/factures', 'page');
        revalidatePath(`/factures/${invoiceId}`, 'page');
        return { success: true };
    } catch (error: any) {
        return handleActionError(error);
    }
}

export async function importInvoice(invoice: Facture, clientName: string) {
    return createInvoice(invoice);
}

export async function fetchDeletedInvoices(societeId: string) {
    try {
        const invoices = await prisma.facture.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: { not: null } },
            // @ts-ignore
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
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

export async function fetchArchivedInvoices(societeId: string) {
    try {
        const invoices = await prisma.facture.findMany({
            // @ts-ignore
            where: { societeId, statut: 'Archivée', deletedAt: null },
            orderBy: { dateEmission: 'desc' },
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
        });
        const mapped = invoices.map((inv: any) => ({
            id: inv.id,
            numero: inv.numero,
            clientId: inv.clientId,
            client: inv.client,
            societeId: inv.societeId,
            dateEmission: inv.dateEmission.toISOString(),
            echeance: inv.dateEcheance ? inv.dateEcheance.toISOString() : "",
            statut: inv.statut as any,
            totalHT: inv.totalHT,
            totalTTC: inv.totalTTC,
            items: inv.itemsJSON ? JSON.parse(inv.itemsJSON) : [],
            type: "Facture",
            createdAt: inv.createdAt.toISOString(),
            updatedAt: inv.updatedAt.toISOString(),
            deletedAt: null, // Explicitly null
            archivedAt: inv.archivedAt ? inv.archivedAt.toISOString() : undefined
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markInvoiceAsSent(id: string) {
    try {
        // Guard
        const mutabilityCheck = await checkInvoiceMutability(id);
        if (!mutabilityCheck.success) return mutabilityCheck;

        const invoice = await prisma.facture.findUnique({ where: { id } });
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

export async function markInvoiceAsDownloaded(id: string) {
    try {
        await prisma.facture.update({
            where: { id },
            data: { statut: "Téléchargée" }
        });
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
