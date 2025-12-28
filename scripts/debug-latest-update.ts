
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching latest UPDATED invoice...");

    const invoice = await prisma.facture.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: { items: true }
    });

    if (!invoice) {
        console.log("No invoices found.");
        return;
    }

    console.log(`Latest Updated Invoice: ${invoice.numero} (${invoice.id})`);
    console.log(`Updated At: ${invoice.updatedAt}`);
    console.log("--- itemsJSON ---");
    console.log(invoice.itemsJSON);
    console.log("-----------------");
}

main();
