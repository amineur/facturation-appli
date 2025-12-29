"use server";

import { prisma } from '@/lib/prisma';
import type { User, Societe, Facture, Devis } from '@/types';

interface DashboardData {
    user: User | null;
    societes: Societe[];
    invoices: Partial<Facture>[];
    quotes: Partial<Devis>[];
}

export async function fetchDashboardData(userId: string, societeId: string): Promise<{ success: boolean, data?: DashboardData, error?: string }> {
    try {
        const startTotal = Date.now();


        // Single Prisma transaction with all queries
        const [user, societes, invoices, quotes] = await prisma.$transaction([
            // User with societes
            prisma.user.findUnique({
                where: { id: userId },
                include: {
                    societes: {
                        select: {
                            id: true,
                            nom: true,
                            logoUrl: true
                        }
                    }
                }
            }),

            // All societes
            prisma.societe.findMany(),

            // Invoices for societe
            prisma.facture.findMany({
                where: { societeId, deletedAt: null, statut: { not: 'Archivée' as any } },
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
                    },
                    itemsJSON: true,
                    config: true
                },
                orderBy: [
                    { dateEmission: 'desc' },
                    { numero: 'desc' }
                ],
                take: 50
            }),

            // Quotes for societe
            prisma.devis.findMany({
                where: { societeId, deletedAt: null, statut: { not: 'Archivé' as any } },
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
                        select: { nom: true }
                    },
                    itemsJSON: true,
                    config: true
                },
                orderBy: [
                    { dateEmission: 'desc' },
                    { numero: 'desc' }
                ],
                take: 50
            })
        ]);

        const totalTime = Date.now() - startTotal;


        // Map user
        const mappedUser = user ? {
            id: user.id,
            email: user.email,
            fullName: user.fullName || '',
            role: user.role,
            avatarUrl: user.avatarUrl || undefined,
            societes: user.societes.map(s => s.id),
            currentSocieteId: societeId,
            permissions: [] // Default empty permissions
        } as User : null;

        // Map societes (convert Date fields to strings)
        const mappedSocietes = societes.map((s: any) => ({
            ...s,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString()
        })) as Societe[];

        // Map invoices
        const mappedInvoices = invoices.map((inv: any) => {
            let items: any[] = [];
            try {
                if (inv.itemsJSON) {
                    const parsed = JSON.parse(inv.itemsJSON);
                    items = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                }
            } catch (e) {
                console.error("Error parsing itemsJSON for invoice:", inv.id);
            }
            return {
                id: inv.id,
                numero: inv.numero,
                clientId: inv.clientId,
                societeId: inv.societeId,
                dateEmission: inv.dateEmission.toISOString(),
                echeance: inv.dateEcheance ? inv.dateEcheance.toISOString() : "",
                statut: inv.statut,
                totalHT: inv.totalHT,
                totalTTC: inv.totalTTC,
                datePaiement: inv.datePaiement ? inv.datePaiement.toISOString() : undefined,
                type: "Facture" as const,
                items: items.map((item: any) => ({
                    description: item.nom || item.description || "Article",
                    quantite: Number(item.quantite) || 0,
                    prixUnitaire: Number(item.prixUnitaire) || 0,
                    totalLigne: Number(item.montantHT || item.totalLigne) || 0,
                    date: item.date // Map date for validation
                })),
                emails: [],
                config: (() => {
                    if (!inv.config) return {};
                    try {
                        const parsed = JSON.parse(inv.config);
                        return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                    } catch { return {}; }
                })()
            };
        });

        // Map quotes
        const mappedQuotes = quotes.map((q: any) => {
            let items: any[] = [];
            try {
                if (q.itemsJSON) {
                    const parsed = JSON.parse(q.itemsJSON);
                    items = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                }
            } catch (e) {
                console.error("Error parsing itemsJSON for quote:", q.id);
            }
            return {
                id: q.id,
                numero: q.numero,
                clientId: q.clientId,
                societeId: q.societeId,
                dateEmission: q.dateEmission.toISOString(),
                dateValidite: q.dateValidite ? q.dateValidite.toISOString() : "",
                statut: q.statut,
                totalHT: q.totalHT,
                totalTTC: q.totalTTC,
                type: "Devis" as const,
                items: items.map((item: any) => ({
                    id: item.id,
                    nom: item.nom || item.description || "Article",
                    description: item.nom || item.description || "Article",
                    quantite: Number(item.quantite) || 0,
                    prixUnitaire: Number(item.prixUnitaire) || 0,
                    tva: Number(item.tva) || 20,
                    remise: Number(item.remise) || 0,
                    remiseType: item.remiseType || 'pourcentage',
                    totalLigne: Number(item.montantHT || item.totalLigne) || 0,
                    montantHT: Number(item.montantHT || item.totalLigne) || 0,
                    date: item.date || "",
                    produitId: item.produitId || "",
                    type: item.type || 'produit'
                })),
                emails: [],
                config: (() => {
                    if (!q.config) return {};
                    try {
                        const parsed = JSON.parse(q.config);
                        return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                    } catch { return {}; }
                })()
            };
        });

        return {
            success: true,
            data: {
                user: mappedUser,
                societes: mappedSocietes,
                invoices: mappedInvoices as any,
                quotes: mappedQuotes as any
            }
        };

    } catch (error: any) {
        console.error('[ERROR] fetchDashboardData:', error);
        return { success: false, error: error.message };
    }
}

export async function fetchDashboardMetrics(societeId: string, dateRange: { start: Date, end: Date }): Promise<{ success: boolean, data?: any, error?: string }> {
    try {
        const { start, end } = dateRange;

        // Fetch invoices within date range
        const invoices = await prisma.facture.findMany({
            where: {
                societeId,
                deletedAt: null,
                dateEmission: {
                    gte: start,
                    lte: end
                }
            },
            select: {
                statut: true,
                totalTTC: true,
                dateEcheance: true,
                datePaiement: true
            }
        });

        // Calculate metrics
        const now = new Date();
        // CA = Toutes les factures sauf Brouillon et Annulée (CA engagé)
        const revenue = invoices
            .filter(inv => inv.statut !== 'Brouillon' && inv.statut !== 'Annulée')
            .reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);

        // Count and amounts by status
        const counts: Record<string, number> = {};
        const amounts: Record<string, number> = {};
        invoices.forEach(inv => {
            counts[inv.statut] = (counts[inv.statut] || 0) + 1;
            amounts[inv.statut] = (amounts[inv.statut] || 0) + (inv.totalTTC || 0);
        });

        // Overdue invoices
        const overdueInvoices = invoices.filter(inv =>
            inv.statut !== 'Payée' &&
            inv.statut !== 'Annulée' &&
            inv.dateEcheance &&
            new Date(inv.dateEcheance) < now
        );
        const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
        const overdueCount = overdueInvoices.length;

        // Due soon (next 7 days)
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const dueSoonInvoices = invoices.filter(inv =>
            inv.statut !== 'Payée' &&
            inv.statut !== 'Annulée' &&
            inv.dateEcheance &&
            new Date(inv.dateEcheance) >= now &&
            new Date(inv.dateEcheance) <= sevenDaysFromNow
        );
        const dueSoonAmount = dueSoonInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
        const dueSoonCount = dueSoonInvoices.length;

        return {
            success: true,
            data: {
                revenue,
                counts,
                amounts,
                overdueAmount,
                overdueCount,
                dueSoonAmount,
                dueSoonCount
            }
        };

    } catch (error: any) {
        console.error('[ERROR] fetchDashboardMetrics:', error);
        return { success: false, error: error.message };
    }
}
