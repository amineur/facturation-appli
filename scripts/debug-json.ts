
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("🔍 Inspecting latest invoice itemsJSON...");

    const invoice = await prisma.facture.findFirst({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            numero: true,
            itemsJSON: true,
            items: true // also check relational just in case
        }
    });

    if (!invoice) {
        console.log("❌ No invoice found.");
        return;
    }

    console.log(`🧾 Invoice: ${invoice.numero} (${invoice.id})`);
    console.log("📦 Relational Items:", invoice.items);
    console.log("📄 Raw itemsJSON:", invoice.itemsJSON);

    try {
        const parsed = JSON.parse(invoice.itemsJSON);
        console.log("✅ Parsed JSON:", JSON.stringify(parsed, null, 2));

        console.log("---------------------------------------------------");
        console.log("🧪 Testing Parsing Logic:");
        parsed.forEach((item: any, idx: number) => {
            const qNum = Number(item.quantite);
            const qParse = parseFloat(String(item.quantite));
            console.log(`   Item ${idx + 1}: Raw Qty="${item.quantite}" (${typeof item.quantite}) -> Number()=${qNum}, parseFloat()=${qParse}`);
        });

    } catch (e) {
        console.error("❌ JSON Parse Error:", e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
