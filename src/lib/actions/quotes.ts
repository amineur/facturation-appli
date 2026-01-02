"use server";

import { prisma } from '@/lib/prisma';
import { Devis } from '@/types';
import { revalidatePath } from "next/cache";
import { ensureProductsExist } from './products';
import { getCurrentUser } from './auth';
import { handleActionError } from './shared';
import { canAccessSociete } from './members';
import { MembershipRole } from '@prisma/client';
import { generateNextQuoteNumber } from '../invoice-utils';

// Helper: Ensure unique quote number
async function ensureUniqueQuoteNumber(numero: string, societeId: string, excludeId?: string): Promise<string> {
    let attempts = 0;
    let currentNumero = numero;

    while (attempts < 10) {
        const existing = await prisma.devis.findFirst({
            where: {
                numero: currentNumero,
                societeId,
                id: excludeId ? { not: excludeId } : undefined
            }
        });

        if (!existing) {
            return currentNumero; // Unique!
        }

        // Number exists, generate next one
        const allQuotes = await prisma.devis.findMany({
            where: { societeId },
            select: { numero: true }
        });

        currentNumero = generateNextQuoteNumber(allQuotes as any);
        attempts++;
    }

    throw new Error('Unable to generate unique quote number after 10 attempts');
}

// Fetch Actions

export async function fetchQuotesLite(societeId: string): Promise<{ success: boolean, data?: Partial<Devis>[], error?: string }> {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const quotes = await prisma.devis.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: null, statut: { not: 'Archivé' } },
            select: {
                id: true,
                numero: true,
                clientId: true,
                societeId: true,
                dateEmission: true,
                dateValidite: true,
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
            ]
        });

        const mapped = quotes.map((q: any) => ({
            id: q.id,
            numero: q.numero,
            clientId: q.clientId,
            societeId: q.societeId,
            dateEmission: q.dateEmission.toISOString(),
            dateValidite: q.dateValidite ? q.dateValidite.toISOString() : "",
            statut: q.statut as any,
            totalHT: q.totalHT,
            totalTTC: q.totalTTC,
            type: "Devis" as const,
            items: [], // Empty for lite version
            emails: [],
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchQuotes(societeId: string): Promise<{ success: boolean, data?: Devis[], error?: string }> {
    return fetchQuotesLegacy(societeId);
}

async function fetchQuotesLegacy(societeId: string): Promise<{ success: boolean, data?: Devis[], error?: string }> {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const quotes = await prisma.devis.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: null, statut: { not: 'Archivé' } },
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            },
            orderBy: [
                { dateEmission: 'desc' },
                { numero: 'desc' }
            ],
            take: 100
        });

        const mapped: Devis[] = quotes.map((q: any) => {
            let items = [];
            let emails = [];
            try {
                if (q.itemsJSON) {
                    const parsed = JSON.parse(q.itemsJSON);
                    items = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                }
                if (q.emailsJSON) {
                    const parsed = JSON.parse(q.emailsJSON);
                    emails = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                }
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
                updatedAt: q.updatedAt ? q.updatedAt.toISOString() : undefined,
                isLocked: q.isLocked,
                config: (() => {
                    if (!q.config) return {};
                    try {
                        const parsed = JSON.parse(q.config);
                        return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                    } catch { return {}; }
                })()
            };
        });
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchQuoteDetails(id: string): Promise<{ success: boolean, data?: Devis, error?: string }> {
    try {
        const q = await prisma.devis.findUnique({
            where: { id },
            // @ts-ignore
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
        });

        if (!q) return { success: false, error: "Devis introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, q.societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        let items = [];
        let emails = [];
        try {
            // @ts-ignore
            if (q.itemsJSON) {
                const parsed = JSON.parse(q.itemsJSON);
                items = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
            }
            // @ts-ignore
            if (q.emailsJSON) {
                const parsed = JSON.parse(q.emailsJSON);
                emails = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
            }
        } catch (e) {
            console.error("Error parsing JSON fields", e);
        }

        const mapped: Devis = {
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
            createdAt: q.createdAt.toISOString(),
            updatedAt: q.updatedAt.toISOString(),
            isLocked: q.isLocked,
            // @ts-ignore
            config: (() => {
                if (!q.config) return {};
                try {
                    const parsed = JSON.parse(q.config);
                    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                } catch { return {}; }
            })()
        };
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createQuote(quote: Devis) {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const targetSocieteId = quote.societeId || userRes.data.currentSocieteId;
        if (!targetSocieteId) return { success: false, error: "Société non spécifiée" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, targetSocieteId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Access refusé" };

        if (!quote.clientId) throw new Error("Client requis");

        // Ensure unique numero
        const uniqueNumero = await ensureUniqueQuoteNumber(quote.numero, targetSocieteId);

        const processedItems = await ensureProductsExist(quote.items || [], targetSocieteId);
        const itemsJson = JSON.stringify(processedItems);

        const res = await prisma.devis.create({
            data: {
                numero: uniqueNumero,
                dateEmission: new Date(quote.dateEmission),
                statut: quote.statut,
                totalHT: quote.totalHT,
                totalTTC: quote.totalTTC,
                dateValidite: quote.dateValidite ? new Date(quote.dateValidite) : null,
                itemsJSON: itemsJson,
                emailsJSON: JSON.stringify(quote.emails || []),
                societeId: targetSocieteId,
                clientId: quote.clientId,
                isLocked: quote.isLocked || false,
                config: JSON.stringify(quote.config || {}),
                // @ts-ignore
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
        revalidatePath('/devis', 'page');
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

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

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
                clientId: quote.clientId,
                isLocked: quote.isLocked,
                config: JSON.stringify(quote.config || {}),
                // @ts-ignore
                items: {
                    deleteMany: {},
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
        revalidatePath(`/devis/${quote.id}`, 'page');
        revalidatePath('/devis', 'page');
        return { success: true };
    } catch (error: any) {
        return handleActionError(error);
    }
}

export async function toggleQuoteLock(quoteId: string, isLocked: boolean) {
    if (!quoteId) return { success: false, error: "ID manquant" };
    try {
        const quote = await prisma.devis.findUnique({ where: { id: quoteId }, select: { societeId: true } });
        if (!quote) return { success: false, error: "Devis introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, quote.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        await prisma.devis.update({
            where: { id: quoteId },
            data: { isLocked }
        });
        revalidatePath('/devis', 'page');
        revalidatePath(`/devis/${quoteId}`, 'page');
        return { success: true };
    } catch (error: any) {
        return handleActionError(error);
    }
}

export async function convertQuoteToInvoice(quoteId: string) {
    try {
        // 1. Fetch Quote
        const quote = await prisma.devis.findUnique({ where: { id: quoteId } });
        if (!quote) return { success: false, error: "Devis introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, quote.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        // 2. Fetch all invoices to determine next number correctly
        // We need all numbers to find the Max.
        const invoices = await prisma.facture.findMany({
            where: { societeId: quote.societeId },
            select: { numero: true }
        });

        const currentYearPrefix = new Date().getFullYear().toString().substring(2);
        let nextNumber = `${currentYearPrefix}010001`;

        const numericInvoices = invoices
            .map((inv: { numero: string }) => inv.numero)
            .filter((num: string) => /^\d{8}$/.test(num))
            .map((num: string) => parseInt(num, 10))
            .filter((num: number) => !isNaN(num));

        if (numericInvoices.length > 0) {
            const maxNumber = Math.max(...numericInvoices);
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
                dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                statut: "Brouillon",
                itemsJSON: itemsJson,
                totalHT: quote.totalHT,
                totalTTC: quote.totalTTC,
                config: quote.config || JSON.stringify({}),
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

export async function importQuote(quote: Devis, clientName: string) {
    return createQuote(quote);
}

export async function updateQuoteStatus(id: string, statut: string) {
    try {
        const quote = await prisma.devis.findUnique({ where: { id }, select: { societeId: true } });
        if (!quote) return { success: false, error: "Devis introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, quote.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

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

export async function fetchDeletedQuotes(societeId: string) {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const quotes = await prisma.devis.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: { not: null } },
            // @ts-ignore
            orderBy: { deletedAt: 'desc' },
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
        });
        const mapped = quotes.map((q: any) => ({
            id: q.id,
            numero: q.numero,
            clientId: q.clientId,
            client: q.client,
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

export async function fetchArchivedQuotes(societeId: string) {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const quotes = await prisma.devis.findMany({
            // @ts-ignore
            where: { societeId, statut: 'Archivé', deletedAt: null },
            orderBy: { dateEmission: 'desc' },
            include: {
                client: {
                    select: { id: true, nom: true }
                }
            }
        });
        const mapped = quotes.map((q: any) => ({
            id: q.id,
            numero: q.numero,
            clientId: q.clientId,
            client: q.client,
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
            deletedAt: null
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
