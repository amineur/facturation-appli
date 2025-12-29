
const { PrismaClient } = require('@prisma/client');
async function main() {
    console.log("📅 Inventory for NOV 2025...");
    const prisma = new PrismaClient();
    try {
        const start = new Date('2025-11-01T00:00:00.000Z');
        const end = new Date('2025-11-30T23:59:59.999Z');
        const invoices = await prisma.facture.findMany({
            where: { dateEmission: { gte: start, lte: end } }, // All status, even deleted if not filtered
            select: { numero: true, statut: true, itemsJSON: true, items: true }
        });
        console.log(`Found ${invoices.length} invoices.`);
        invoices.forEach(inv => {
            console.log(`🧾 ${inv.numero} [${inv.statut}]`);
            let items = [];
            if (inv.itemsJSON) try { items = JSON.parse(inv.itemsJSON) } catch (e) { }
            if (!items.length && inv.items) items = inv.items.map(i => ({ ...i, nom: i.description }));
            items.forEach(i => console.log(`   - ${i.nom || i.description}: Qty=${i.quantite}`));
        });
    } catch (e) { console.error(e) } finally { await prisma.$disconnect() }
}
main();
