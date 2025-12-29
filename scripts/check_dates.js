
const { PrismaClient } = require('@prisma/client');

async function main() {
    console.log("Checking dates for validated invoices...");
    const prisma = new PrismaClient();
    try {
        const invoices = await prisma.facture.findMany({
            where: {
                statut: { in: ["Payée", "Envoyée", "Retard"] },
                deletedAt: null
            },
            select: {
                numero: true,
                dateEmission: true,
                itemsJSON: true,
                items: true
            }
        });

        invoices.forEach(inv => {
            let items = [];
            if (inv.itemsJSON) {
                try { items = JSON.parse(inv.itemsJSON); } catch (e) { }
            }
            if (!items.length && inv.items && inv.items.length) {
                items = inv.items.map(i => ({ ...i, nom: i.description }));
            }

            items.forEach(item => {
                const name = item.nom || item.description;
                if (name && name.trim().toLowerCase().includes('produit tes')) {
                    console.log(`Invoice ${inv.numero}: Date=${inv.dateEmission.toISOString()}, Qty=${item.quantite}`);
                }
            });
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
