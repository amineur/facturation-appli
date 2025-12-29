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
