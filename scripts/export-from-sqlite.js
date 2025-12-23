const { PrismaClient: PrismaClientSQLite } = require('@prisma/client');
const { spawn } = require('child_process');
const fs = require('fs');

// Script to migrate data from SQLite to PostgreSQL
async function migrateSQLiteToPostgres() {
    console.log('🚀 Starting migration from SQLite to PostgreSQL...\n');

    // Step 1: Connect to SQLite
    const sqlitePrisma = new PrismaClientSQLite({
        datasources: {
            db: {
                url: 'file:./prisma/dev.db'
            }
        }
    });

    try {
        await sqlitePrisma.$connect();
        console.log('✅ Connected to SQLite database\n');

        // Step 2: Export data
        console.log('📊 Exporting data from SQLite...');

        const users = await sqlitePrisma.user.findMany();
        const societes = await sqlitePrisma.societe.findMany();
        const clients = await sqlitePrisma.client.findMany();
        const produits = await sqlitePrisma.produit.findMany();
        const factures = await sqlitePrisma.facture.findMany();
        const devis = await sqlitePrisma.devis.findMany();
        const paiements = await sqlitePrisma.paiement.findMany();
        const history = await sqlitePrisma.historyEntry.findMany();

        console.log(`  - Users: ${users.length}`);
        console.log(`  - Sociétés: ${societes.length}`);
        console.log(`  - Clients: ${clients.length}`);
        console.log(`  - Produits: ${produits.length}`);
        console.log(`  - Factures: ${factures.length}`);
        console.log(`  - Devis: ${devis.length}`);
        console.log(`  - Paiements: ${paiements.length}`);
        console.log(`  - History: ${history.length}\n`);

        // Save to JSON for backup
        const exportData = {
            users,
            societes,
            clients,
            produits,
            factures,
            devis,
            paiements,
            history,
            exportedAt: new Date().toISOString()
        };

        fs.writeFileSync('./migration-backup.json', JSON.stringify(exportData, null, 2));
        console.log('✅ Data exported to migration-backup.json\n');

        await sqlitePrisma.$disconnect();

        // Step 3: Now we'll import to PostgreSQL
        console.log('📥 Ready to import to PostgreSQL');
        console.log('⚠️  Run the import script next: node scripts/import-to-postgres.js');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        await sqlitePrisma.$disconnect();
        process.exit(1);
    }
}

migrateSQLiteToPostgres();
