
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking for Verification Record TEST-DW-001...");

    // Find by numero
    const invoice = await prisma.facture.findFirst({
        where: { numero: "TEST-DW-001" },
        include: { items: true }
    });

    if (!invoice) {
        console.error("❌ Record NOT found. Create failed completely.");
        return;
    }

    console.log(`✅ Record Found: ${invoice.id}`);

    // Verify JSON
    let jsonItems: any[] = [];
    try {
        jsonItems = JSON.parse(invoice.itemsJSON);
    } catch { }

    console.log(`JSON Items: ${jsonItems.length}`);
    console.log(`Table Items: ${invoice.items.length}`);

    if (jsonItems.length === 1 && invoice.items.length === 1) {
        console.log("✅ Double Write SUCCESS Confirmed!");
    } else {
        console.error("❌ Double Write Incomplete.");
    }

    // Cleanup
    await prisma.facture.delete({ where: { id: invoice.id } });
    console.log("Cleanup done.");
}

main();
