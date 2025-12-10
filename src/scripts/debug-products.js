
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProducts() {
    try {
        console.log("Checking Products in DB...");
        const count = await prisma.produit.count();
        console.log(`Total Products: ${count}`);

        const products = await prisma.produit.findMany({
            take: 5,
            select: { id: true, nom: true, societeId: true }
        });
        console.log("Sample Products:", JSON.stringify(products, null, 2));

        console.log("\nChecking Societes...");
        const societes = await prisma.societe.findMany({
            select: { id: true, nom: true }
        });
        console.log("Societes:", JSON.stringify(societes, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkProducts();
