"use server";

import { prisma } from '@/lib/prisma';

export async function fetchDashboardMetrics(societeId: string, range: { start: Date, end: Date }) {
    try {
        // Server-side aggregation for Dashboard
        const totalRevenue = await prisma.facture.aggregate({
            // @ts-ignore
            where: {
                societeId,
                deletedAt: null,
                statut: "Payée",
                dateEmission: {
                    gte: range.start,
                    lte: range.end
                }
            },
            _sum: { totalTTC: true }
        });

        const counts = await prisma.facture.groupBy({
            // @ts-ignore
            by: ['statut'],
            where: {
                societeId,
                deletedAt: null,
                dateEmission: {
                    gte: range.start,
                    lte: range.end
                }
            },
            _count: true
        });

        const overdue = await prisma.facture.aggregate({
            // @ts-ignore
            where: {
                societeId,
                deletedAt: null,
                statut: "Retard" // Or logic based on echeance date < now
            },
            _sum: { totalTTC: true },
            _count: true
        });

        // Due Soon (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const dueSoon = await prisma.facture.aggregate({
            // @ts-ignore
            where: {
                societeId,
                deletedAt: null,
                statut: { in: ["Envoyée", "Brouillon"] },
                dateEcheance: {
                    lte: nextWeek,
                    gte: new Date()
                }
            },
            _sum: { totalTTC: true },
            _count: true
        });

        return {
            success: true,
            data: {
                revenue: totalRevenue._sum.totalTTC || 0,
                counts: counts.reduce((acc: any, curr: any) => ({ ...acc, [curr.statut]: curr._count }), {}),
                overdueAmount: overdue._sum.totalTTC || 0,
                overdueCount: overdue._count,
                dueSoonAmount: dueSoon._sum.totalTTC || 0,
                dueSoonCount: dueSoon._count
            }
        };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
