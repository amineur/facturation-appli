
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const invoices = await prisma.facture.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    console.log("Analyze Invoice Items:");
    invoices.forEach(inv => {
        console.log(`Invoice ${inv.numero} (ID: ${inv.id}):`);
        try {
            const items = JSON.parse(inv.itemsJSON || "[]");
            console.log(JSON.stringify(items, null, 2));
        } catch (e) {
            console.log("Error parsing JSON:", inv.itemsJSON);
        }
    });

    const products = await prisma.produit.findMany({ take: 5 });
    console.log("\nSample Products:");
    products.forEach(p => console.log(`Product: ${p.nom} (ID: ${p.id})`));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
