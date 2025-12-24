import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // Simulate frontend scoping logic server-side
        const { searchParams } = new URL(request.url);
        const storageUserId = searchParams.get('userId') || 'usr_1'; // Pass from query or default

        // 1. Resolve user from DB
        const user = await prisma.user.findUnique({
            where: { id: storageUserId },
            include: { societes: true }
        });

        if (!user) {
            return NextResponse.json({
                error: 'User not found',
                storageUserId,
                resolvedUserId: null
            });
        }

        // 2. Get all societies
        const allSocietes = await prisma.societe.findMany({
            select: { id: true, nom: true }
        });

        // 3. Determine active société (simulate localStorage logic)
        // Priority: user.currentSocieteId, then first société
        let activeSocieteId = user.currentSocieteId;
        if (!activeSocieteId && allSocietes.length > 0) {
            activeSocieteId = allSocietes[0].id;
        }

        const activeSociete = allSocietes.find(s => s.id === activeSocieteId);

        // 4. Count data scoped by activeSocieteId
        const counts = {
            factures: 0,
            devis: 0,
            clients: 0,
            produits: 0
        };

        if (activeSocieteId) {
            [counts.factures, counts.devis, counts.clients, counts.produits] = await Promise.all([
                prisma.facture.count({ where: { societeId: activeSocieteId } }),
                prisma.devis.count({ where: { societeId: activeSocieteId } }),
                prisma.client.count({ where: { societeId: activeSocieteId } }),
                prisma.produit.count({ where: { societeId: activeSocieteId } })
            ]);
        }

        // 5. Get date range info (if any filters exist)
        const oldestFacture = await prisma.facture.findFirst({
            where: { societeId: activeSocieteId || undefined },
            orderBy: { dateEmission: 'asc' },
            select: { dateEmission: true }
        });

        const newestFacture = await prisma.facture.findFirst({
            where: { societeId: activeSocieteId || undefined },
            orderBy: { dateEmission: 'desc' },
            select: { dateEmission: true }
        });

        return NextResponse.json({
            scope: {
                storageUserId,
                resolvedUserId: user.id,
                userEmail: user.email,
                currentSocieteId: user.currentSocieteId,
                activeSocieteId,
                activeSocieteName: activeSociete?.nom || null,
                validSocietesCount: allSocietes.length,
                allSocietes: allSocietes.map(s => ({ id: s.id, nom: s.nom }))
            },
            dateRange: {
                oldest: oldestFacture?.dateEmission || null,
                newest: newestFacture?.dateEmission || null
            },
            counts,
            diagnosis: {
                hasSocieteId: !!activeSocieteId,
                hasData: counts.factures > 0 || counts.devis > 0,
                issue: !activeSocieteId ? 'NO_SOCIETE_ID' :
                    (counts.factures === 0 && counts.devis === 0) ? 'NO_DATA_FOR_SOCIETE' :
                        'OK'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
