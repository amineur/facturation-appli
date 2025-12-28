
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching latest invoice...");

    const invoice = await prisma.facture.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { items: true }
    });

    if (!invoice) {
        console.log("No invoices found.");
        return;
    }

    console.log(`Latest Invoice: ${invoice.numero} (${invoice.id})`);
    console.log("--- itemsJSON ---");
    console.log(invoice.itemsJSON);
    console.log("-----------------");
    console.log(`--- Relation Items (Count: ${invoice.items.length}) ---`);
    console.log(JSON.stringify(invoice.items, null, 2));
    console.log("-----------------");
}

main();
