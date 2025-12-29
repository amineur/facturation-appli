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
        console.log('[PERF] fetchDashboardData START');

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
                    }
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
                    }
                },
                orderBy: [
                    { dateEmission: 'desc' },
                    { numero: 'desc' }
                ],
                take: 50
            })
        ]);

        const totalTime = Date.now() - startTotal;
        console.log('[PERF] fetchDashboardData TOTAL:', totalTime, 'ms');
        console.log('[PERF] Counts - Invoices:', invoices.length, '| Quotes:', quotes.length);

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
        const mappedInvoices = invoices.map((inv: any) => ({
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
            items: [],
            emails: []
        }));

        // Map quotes
        const mappedQuotes = quotes.map((q: any) => ({
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
            items: [],
            emails: []
        }));

        return {
            success: true,
            data: {
                user: mappedUser,
                societes: mappedSocietes,
                invoices: mappedInvoices,
                quotes: mappedQuotes
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
        const revenue = invoices
            .filter(inv => inv.statut === 'Payée')
            .reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);

        // Count by status
        const counts: Record<string, number> = {};
        invoices.forEach(inv => {
            counts[inv.statut] = (counts[inv.statut] || 0) + 1;
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
