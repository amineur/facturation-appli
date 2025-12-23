
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnosing Data Scope ---');

    // 1. Check Societes
    const societes = await prisma.societe.findMany();
    console.log(`\nFound ${societes.length} Societes:`);
    societes.forEach(s => {
        console.log(`- [${s.id}] ${s.nom}`);
    });

    // 2. Check Users
    const users = await prisma.user.findMany({ include: { societes: true } });
    console.log(`\nFound ${users.length} Users:`);
    users.forEach(u => {
        console.log(`- [${u.id}] ${u.email} (Current Scope: ${u.currentSocieteId})`);
        console.log(`  Member of: ${u.societes.map(s => s.nom).join(', ')}`);
    });

    // 3. Check Invoices Distribution and Dates
    const invoiceCounts = await prisma.facture.groupBy({
        by: ['societeId'],
        _count: { id: true },
    });
    console.log(`\nInvoices Distribution:`);
    if (invoiceCounts.length === 0) {
        const allInvoices = await prisma.facture.count();
        console.log(`No invoices grouped by societeId found. Total invoices in DB: ${allInvoices}`);
    } else {
        invoiceCounts.forEach(c => {
            console.log(`- Societe [${c.societeId}]: ${c._count.id} invoices`);
        });

        // Check dates and status for Euromedmultimedia
        const invoices = await prisma.facture.findMany({
            where: { societeId: 'Euromedmultimedia' },
            select: { id: true, dateEmission: true, deletedAt: true, statut: true },
            orderBy: { dateEmission: 'desc' },
            take: 5
        });
        console.log('\nTop 5 Recent Invoices (Euromedmultimedia):');
        invoices.forEach(inv => console.log(`[${inv.id}] Date: ${inv.dateEmission}, Status: ${inv.statut}, Deleted: ${inv.deletedAt}`));

        const countDeleted = await prisma.facture.count({ where: { societeId: 'Euromedmultimedia', deletedAt: { not: null } } });
        const countArchived = await prisma.facture.count({ where: { societeId: 'Euromedmultimedia', statut: 'Archivée' } });
        const countVisible = await prisma.facture.count({
            where: {
                societeId: 'Euromedmultimedia',
                deletedAt: null,
                statut: { not: 'Archivée' }
            }
        });

        console.log(`\nStats for Euromedmultimedia:`);
        console.log(`- Deleted: ${countDeleted}`);
        console.log(`- Archived: ${countArchived}`);
        console.log(`- Visible (should be): ${countVisible}`);

    }

    // 4. Check Quotes Distribution
    const quoteCounts = await prisma.devis.groupBy({
        by: ['societeId'],
        _count: { id: true },
    });
    console.log(`\nQuotes Distribution:`);
    quoteCounts.forEach(c => {
        console.log(`- Societe [${c.societeId}]: ${c._count.id} quotes`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
