"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from "next/cache";

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
        let finalSocieteId = entry.societeId;

        // Backend Inference: If entityId is present, try to deduce the REAL societeId from the DB entity
        // This fixes bugs where frontend might pass the wrong context or no context.
        if (entry.entityId) {
            let fetchedSocieteId: string | undefined | null;

            if (entry.entityType === 'facture') {
                const item = await prisma.facture.findUnique({ where: { id: entry.entityId }, select: { societeId: true } });
                fetchedSocieteId = item?.societeId;
            } else if (entry.entityType === 'devis') {
                const item = await prisma.devis.findUnique({ where: { id: entry.entityId }, select: { societeId: true } });
                fetchedSocieteId = item?.societeId;
            } else if (entry.entityType === 'client') {
                const item = await prisma.client.findUnique({ where: { id: entry.entityId }, select: { societeId: true } });
                fetchedSocieteId = item?.societeId;
            } else if (entry.entityType === 'produit') {
                const item = await prisma.produit.findUnique({ where: { id: entry.entityId }, select: { societeId: true } });
                fetchedSocieteId = item?.societeId;
            }

            if (fetchedSocieteId) {
                finalSocieteId = fetchedSocieteId;
            }
        }

        await prisma.historyEntry.create({
            data: {
                userId: entry.userId,
                action: entry.action,
                entityType: entry.entityType,
                description: entry.description,
                entityId: entry.entityId,
                societeId: finalSocieteId
            }
        });
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

export async function unarchiveRecord(tableName: 'Factures' | 'Devis', id: string) {
    try {
        if (tableName === 'Factures') {
            await prisma.facture.update({
                where: { id },
                // @ts-ignore
                data: { statut: 'Brouillon', deletedAt: new Date() } // Move to Trash
            });
        } else if (tableName === 'Devis') {
            await prisma.devis.update({
                where: { id },
                // @ts-ignore
                data: { statut: 'Brouillon', deletedAt: new Date() } // Move to Trash
            });
        }
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function archiveRecord(tableName: 'Factures' | 'Devis', id: string) {
    try {
        if (tableName === 'Factures') {
            await prisma.facture.update({
                where: { id },
                // @ts-ignore
                data: { statut: 'Archivée', deletedAt: null, isLocked: true, archivedAt: new Date() } // Move to Archive with Immutable Flag
            });

        } else if (tableName === 'Devis') {
            await prisma.devis.update({
                where: { id },
                // @ts-ignore
                data: { statut: 'Archivé', deletedAt: null } // Move to Archive
            });
        }
        revalidatePath("/", "layout");
        return { success: true };
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

export async function emptyTrash(societeId: string) {
    try {
        // Archive Invoices
        await prisma.facture.updateMany({
            // @ts-ignore
            where: { societeId, deletedAt: { not: null } },
            // @ts-ignore
            data: { deletedAt: null, statut: 'Archivée', isLocked: true, archivedAt: new Date() } // Immutable
        });
        // Archive Quotes
        await prisma.devis.updateMany({
            // @ts-ignore
            where: { societeId, deletedAt: { not: null } },
            // @ts-ignore
            data: { deletedAt: null, statut: 'Archivé' }
        });
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function permanentlyDeleteRecord(tableName: 'Factures' | 'Devis', id: string) {
    try {
        if (tableName === 'Factures') {
            throw new Error("Les factures ne peuvent pas être supprimées définitivement.");
        } else if (tableName === 'Devis') {
            await prisma.devis.delete({ where: { id } });
        }
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
