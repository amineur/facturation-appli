
const { PrismaClient } = require('@prisma/client');

async function main() {
    console.log("📅 Inventory for December 2025...");
    const prisma = new PrismaClient();
    try {
        const start = new Date('2025-12-01T00:00:00.000Z');
        const end = new Date('2025-12-31T23:59:59.999Z');

        const invoices = await prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                deletedAt: null // Only active invoices
            },
            select: {
                id: true,
                numero: true,
                statut: true,
                itemsJSON: true,
                items: true
            },
            orderBy: { dateEmission: 'asc' }
        });

        console.log(`Found ${invoices.length} invoices in December.`);

        invoices.forEach(inv => {
            console.log(`\n🧾 Invoice ${inv.numero} [${inv.statut}]`);

            let items = [];
            if (inv.itemsJSON) {
                try { items = JSON.parse(inv.itemsJSON); } catch (e) { }
            }
            if (!items.length && inv.items) items = inv.items.map(i => ({ ...i, nom: i.description }));

            if (!items.length) console.log("   (No items)");

            items.forEach(item => {
                console.log(`   - ${item.nom || item.description}: Qty=${item.quantite} (Price=${item.prixUnitaire})`);
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
