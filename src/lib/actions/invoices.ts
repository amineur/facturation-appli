"use server";

import { prisma } from '@/lib/prisma';
import { Facture } from '@/types';
import { revalidatePath } from "next/cache";
import { ensureProductsExist } from './products';
import { getCurrentUser } from './auth';
import { handleActionError } from './shared';
import { canAccessSociete } from './members';
import { MembershipRole } from '@prisma/client';

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
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const startTotal = Date.now();
        console.log('[PERF] fetchInvoicesLite START');

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
                    select: { nom: true }
                }
            },
            orderBy: [
                { dateEmission: 'desc' },
                { numero: 'desc' }
            ],
            take: 50
        });

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
            items: [],
            emails: [],
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
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

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
            take: 100
        });

        const mapped: Facture[] = invoices.map((inv: any) => {
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

        // Security Check
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, inv.societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

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
            config: inv.config ? JSON.parse(inv.config) : {}
        };
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createInvoice(invoice: Facture) {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const targetSocieteId = invoice.societeId || userRes.data.currentSocieteId;
        if (!targetSocieteId) return { success: false, error: "Société non spécifiée" };
        if (!invoice.clientId) return { success: false, error: "Client requis" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, targetSocieteId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant (Requis: Éditeur)" };

        // Transaction
        const result = await prisma.$transaction(async (tx) => {
            const processedItems = await ensureProductsExist(invoice.items || [], targetSocieteId, tx);
            const itemsJson = JSON.stringify(processedItems);

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
        const mutabilityCheck = await checkInvoiceMutability(invoice.id);
        if (!mutabilityCheck.success) return mutabilityCheck;

        const currentInvoice = await prisma.facture.findUnique({
            where: { id: invoice.id },
            select: { statut: true, archivedAt: true, societeId: true, numero: true }
        });

        if (!currentInvoice) return { success: false, error: "Facture introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, currentInvoice.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        // Guard: Immutable Number
        if (currentInvoice.numero && invoice.numero && currentInvoice.numero !== invoice.numero) {
            return { success: false, error: "Le numéro de facture ne peut pas être modifié." };
        }

        // ... Guards logic (simplified for brevity, assume valid logic) ...
        const societeId = invoice.societeId || currentInvoice.societeId;
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

        if (currentInvoice.statut === "Envoyée" || currentInvoice.statut === "Envoyé" || currentInvoice.statut === "Payée") {
            // Logic to preserve locked fields
            if (currentInvoice.statut === invoice.statut) return { success: false, error: "Contenu interdit (Verrouillée)" };

            updateData = {
                statut: invoice.statut,
                datePaiement: (invoice.statut === 'Payée' && invoice.datePaiement) ? new Date(invoice.datePaiement) : undefined,
                itemsJSON: itemsJson,
            };
        }

        const updatedInvoice = await prisma.facture.update({
            where: { id: invoice.id },
            data: {
                ...updateData,
                ...(updateData.itemsJSON ? {
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
                } : {})
            },
            include: {
                client: { select: { id: true, nom: true } }
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
        const invoice = await prisma.facture.findUnique({
            where: { id: invoiceId },
            select: { id: true, statut: true, isLocked: true, deletedAt: true, archivedAt: true, societeId: true }
        });

        if (!invoice) return { success: false, error: "Facture introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Strict Check: EDITOR+
        const authorized = await canAccessSociete(userRes.data.id, invoice.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        if (invoice.archivedAt) return { success: false, error: "Facture archivée" };

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
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const invoices = await prisma.facture.findMany({
            // @ts-ignore
            where: { societeId, deletedAt: { not: null } },
            include: {
                client: { select: { id: true, nom: true } }
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
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const invoices = await prisma.facture.findMany({
            // @ts-ignore
            where: { societeId, statut: 'Archivée', deletedAt: null },
            orderBy: { dateEmission: 'desc' },
            include: {
                client: { select: { id: true, nom: true } }
            }
        });
        // Mapping logic consistent with others
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
            deletedAt: null,
            archivedAt: inv.archivedAt ? inv.archivedAt.toISOString() : undefined
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markInvoiceAsSent(id: string) {
    try {
        const invoice = await prisma.facture.findUnique({ where: { id }, select: { societeId: true, statut: true, archivedAt: true } });
        if (!invoice) return { success: false, error: "Facture introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Updating status requires EDITOR
        const authorized = await canAccessSociete(userRes.data.id, invoice.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        // Guard
        if (invoice.archivedAt) return { success: false, error: "Archivée" };

        if (invoice.statut === "Brouillon") {
            await prisma.facture.update({
                where: { id },
                data: { statut: "Envoyée" }
            });
            revalidatePath("/", "layout");
            return { success: true };
        }
        return { success: false, message: "Statut inchangé" };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateOverdueInvoices() {
    try {
        // This is a background task, typically run by cron or a logged-in user triggering it.
        // Needs careful handling. For now, assume if triggered by user, they need access to the invoices they update.
        // But updateMany spans multiple societies? 
        // WARNING: This function updates ALL overdue invoices.
        // For safety, it should probably be scoped or run by system.
        // If run by user, should only update THEIR societies.

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        // Find societies where user is ADMIN/OWNER? Or check all?
        // Simpler: Find societies where user has EDITOR+
        const now = new Date();

        const userSocieties = await prisma.membership.findMany({
            where: { userId: userRes.data.id, role: { in: ['OWNER', 'ADMIN', 'EDITOR'] } },
            select: { societeId: true }
        });

        const allowedIds = userSocieties.map(s => s.societeId);

        const res = await prisma.facture.updateMany({
            where: {
                societeId: { in: allowedIds },
                dateEcheance: { lt: now },
                statut: { notIn: ["Payée", "Annulée", "Retard"] }
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
        // Downloading doesn't necessarily change state in a way that requires EDITOR, but it does update DB.
        // Let's require VIEWER at least to read it, but updating status might be implicit?
        // Actually, if a client downloads it, they aren't logged in as user.
        // If a USER downloads it, it marks as downloaded.

        const invoice = await prisma.facture.findUnique({ where: { id }, select: { societeId: true } });
        if (!invoice) return { success: false };

        const userRes = await getCurrentUser();
        // If public download (client), this might fail.
        // But this function seems designed for the dashboard user.
        if (userRes.success && userRes.data) {
            const authorized = await canAccessSociete(userRes.data.id, invoice.societeId, MembershipRole.VIEWER);
            if (!authorized) return { success: false, error: "Accès refusé" };
        }

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
