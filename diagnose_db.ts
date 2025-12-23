import { prisma } from './src/lib/prisma';

async function diagnoseData() {
    console.log("=== DATABASE DIAGNOSTIC ===\n");

    // Count Societes
    const societesCount = await prisma.societe.count();
    console.log(`📊 Societes: ${societesCount}`);

    if (societesCount > 0) {
        const societes = await prisma.societe.findMany({ select: { id: true, nom: true } });
        console.log("   Societes found:", societes);
    }

    // Count Users
    const usersCount = await prisma.user.count();
    console.log(`👤 Users: ${usersCount}`);

    if (usersCount > 0) {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, currentSocieteId: true }
        });
        console.log("   Users found:", users);
    }

    // Count Invoices
    const invoicesCount = await prisma.facture.count();
    console.log(`📄 Invoices: ${invoicesCount}`);

    // Count Quotes
    const quotesCount = await prisma.devis.count();
    console.log(`📝 Quotes: ${quotesCount}`);

    // Count Clients
    const clientsCount = await prisma.client.count();
    console.log(`🏢 Clients: ${clientsCount}`);

    // Count Products
    const productsCount = await prisma.produit.count();
    console.log(`📦 Products: ${productsCount}`);

    console.log("\n=== CONCLUSION ===");
    if (societesCount === 0) {
        console.log("❌ DATABASE IS EMPTY - No societes found!");
        console.log("   This happened because 'prisma migrate dev' reset the database.");
        console.log("   Solution: Run 'npx prisma db seed' or restore from backup.");
    } else {
        console.log("✅ Database has data.");
        console.log("   The issue is likely with currentSocieteId scoping.");
    }

    await prisma.$disconnect();
}

diagnoseData().catch(console.error);
