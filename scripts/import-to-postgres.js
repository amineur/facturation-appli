const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function importToPostgres() {
    console.log('🚀 Starting import to PostgreSQL...\n');

    // Read exported data
    const data = JSON.parse(fs.readFileSync('./migration-backup.json', 'utf8'));
    const prisma = new PrismaClient();

    try {
        await prisma.$connect();
        console.log('✅ Connected to PostgreSQL\n');

        // Import in order (dependencies first)
        console.log('📥 Importing Users...');
        for (const user of data.users) {
            await prisma.user.upsert({
                where: { id: user.id },
                update: user,
                create: user
            });
        }
        console.log(`  ✅ ${data.users.length} users imported\n`);

        console.log('📥 Importing Sociétés...');
        for (const societe of data.societes) {
            await prisma.societe.upsert({
                where: { id: societe.id },
                update: societe,
                create: societe
            });
        }
        console.log(`  ✅ ${data.societes.length} sociétés imported\n`);

        console.log('📥 Importing Clients...');
        for (const client of data.clients) {
            await prisma.client.upsert({
                where: { id: client.id },
                update: client,
                create: client
            });
        }
        console.log(`  ✅ ${data.clients.length} clients imported\n`);

        console.log('📥 Importing Produits...');
        for (const produit of data.produits) {
            await prisma.produit.upsert({
                where: { id: produit.id },
                update: produit,
                create: produit
            });
        }
        console.log(`  ✅ ${data.produits.length} produits imported\n`);

        console.log('📥 Importing Factures...');
        for (const facture of data.factures) {
            await prisma.facture.upsert({
                where: { id: facture.id },
                update: facture,
                create: facture
            });
        }
        console.log(`  ✅ ${data.factures.length} factures imported\n`);

        console.log('📥 Importing Devis...');
        for (const devis of data.devis) {
            await prisma.devis.upsert({
                where: { id: devis.id },
                update: devis,
                create: devis
            });
        }
        console.log(`  ✅ ${data.devis.length} devis imported\n`);

        console.log('📥 Importing Paiements...');
        for (const paiement of data.paiements) {
            await prisma.paiement.upsert({
                where: { id: paiement.id },
                update: paiement,
                create: paiement
            });
        }
        console.log(`  ✅ ${data.paiements.length} paiements imported\n`);

        console.log('📥 Importing History...');
        for (const entry of data.history) {
            await prisma.historyEntry.upsert({
                where: { id: entry.id },
                update: entry,
                create: entry
            });
        }
        console.log(`  ✅ ${data.history.length} history entries imported\n`);

        await prisma.$disconnect();
        console.log('🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Import failed:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

importToPostgres();
