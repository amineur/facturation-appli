
const { PrismaClient } = require('@prisma/client');

async function main() {
    console.log("🔍 Auditing ALL Validated Invoices (Global Sum)...");

    const prisma = new PrismaClient();

    try {
        const invoices = await prisma.facture.findMany({
            where: {
                statut: { in: ["Payée", "Envoyée", "Retard"] },
                deletedAt: null
            },
            select: {
                id: true,
                numero: true,
                itemsJSON: true,
                items: {
                    select: {
                        description: true,
                        quantite: true
                    }
                }
            }
        });

        console.log(`found ${invoices.length} validated invoices.`);

        const stats = new Map();

        for (const inv of invoices) {
            let items = [];
            if (inv.itemsJSON) {
                try { items = JSON.parse(inv.itemsJSON); } catch (e) { }
            }
            // Fallback to relational if JSON is empty/invalid but relational exists?
            // Actually, my recent fix enforces JSON usage, but let's see.
            if (!items.length && inv.items && inv.items.length) {
                items = inv.items.map(i => ({ ...i, nom: i.description }));
            }

            if (!items.length) continue;

            for (const item of items) {
                const rawName = item.nom || item.description;
                if (!rawName) continue;

                const key = rawName.trim().toLowerCase();
                // Handle various quantity formats
                let qty = 0;
                if (typeof item.quantite === 'number') qty = item.quantite;
                else qty = parseFloat(String(item.quantite)) || 0;

                const current = stats.get(key) || { count: 0, name: rawName, invoices: [] };
                current.count += qty;
                current.invoices.push(`${inv.numero} (qt=${qty})`);
                stats.set(key, current);
            }
        }

        console.log("---------------------------------------------------");
        console.log("🏆 TOP PRODUCTS (Calculated by Script):");
        Array.from(stats.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .forEach((p, i) => {
                console.log(`#${i + 1} [${p.name}]: Total Qty = ${p.count}`);
                console.log(`    Detail: ${p.invoices.join(', ')}`);
            });

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
