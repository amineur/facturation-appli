require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const sqlite3 = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');

async function migrateSQLiteToPostgres() {
    console.log('🚀 Migration SQLite → PostgreSQL\n');

    const db = sqlite3('./data/dev.db', { readonly: true });
    const prisma = new PrismaClient();

    try {
        await prisma.$connect();
        console.log('✅ Connected to PostgreSQL (Neon)\n');

        console.log('📤 Exporting from SQLite...');
        const users = db.prepare('SELECT * FROM User').all();
        const societes = db.prepare('SELECT * FROM Societe').all();
        const clients = db.prepare('SELECT * FROM Client').all();
        const produits = db.prepare('SELECT * FROM Produit').all();
        const factures = db.prepare('SELECT * FROM Facture').all();
        const devis = db.prepare('SELECT * FROM Devis').all();
        const history = db.prepare('SELECT * FROM HistoryEntry').all();

        console.log(`  Users: ${users.length}`);
        console.log(`  Sociétés: ${societes.length}`);
        console.log(`  Clients: ${clients.length}`);
        console.log(`  Produits: ${produits.length}`);
        console.log(`  Factures: ${factures.length}`);
        console.log(`  Devis: ${devis.length}`);
        console.log(`  History: ${history.length}\n`);

        console.log('📥 Importing to PostgreSQL...\n');

        // 1. Users - avec conversion de types
        console.log('  → Users...');
        for (const user of users) {
            const userData = {
                id: user.id,
                email: user.email,
                password: user.password,
                fullName: user.fullName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                avatarBytes: user.avatarBytes,
                avatarMime: user.avatarMime,
                hasAvatar: Boolean(user.hasAvatar), // Conversion Int -> Boolean
                currentSocieteId: user.currentSocieteId,
                createdAt: new Date(user.createdAt),
                updatedAt: new Date(user.updatedAt),
                lastReadHistory: new Date(user.lastReadHistory)
            };
            await prisma.user.upsert({
                where: { id: user.id },
                update: userData,
                create: userData
            });
        }
        console.log(`    ✅ ${users.length} imported`);

        // 2. Sociétés
        console.log('  → Sociétés...');
        for (const soc of societes) {
            const socData = {
                ...soc,
                smtpSecure: Boolean(soc.smtpSecure), // Conversion Int -> Boolean
                createdAt: new Date(soc.createdAt),
                updatedAt: new Date(soc.updatedAt)
            };
            await prisma.societe.upsert({
                where: { id: soc.id },
                update: socData,
                create: socData
            });
        }
        console.log(`    ✅ ${societes.length} imported`);

        // 3. Clients
        console.log('  → Clients...');
        for (const client of clients) {
            const clientData = {
                ...client,
                createdAt: new Date(client.createdAt),
                updatedAt: new Date(client.updatedAt)
            };
            await prisma.client.upsert({
                where: { id: client.id },
                update: clientData,
                create: clientData
            });
        }
        console.log(`    ✅ ${clients.length} imported`);

        // 4. Produits
        console.log('  → Produits...');
        for (const prod of produits) {
            const prodData = {
                ...prod,
                createdAt: new Date(prod.createdAt),
                updatedAt: new Date(prod.updatedAt)
            };
            await prisma.produit.upsert({
                where: { id: prod.id },
                update: prodData,
                create: prodData
            });
        }
        console.log(`    ✅ ${produits.length} imported`);

        // 5. Factures
        console.log('  → Factures...');
        for (const fac of factures) {
            const facData = {
                ...fac,
                isLocked: Boolean(fac.isLocked),
                dateEmission: new Date(fac.dateEmission),
                dateEcheance: fac.dateEcheance ? new Date(fac.dateEcheance) : null,
                datePaiement: fac.datePaiement ? new Date(fac.datePaiement) : null,
                createdAt: new Date(fac.createdAt),
                updatedAt: new Date(fac.updatedAt),
                deletedAt: fac.deletedAt ? new Date(fac.deletedAt) : null,
                archivedAt: fac.archivedAt ? new Date(fac.archivedAt) : null
            };
            await prisma.facture.upsert({
                where: { id: fac.id },
                update: facData,
                create: facData
            });
        }
        console.log(`    ✅ ${factures.length} imported`);

        // 6. Devis
        console.log('  → Devis...');
        for (const dev of devis) {
            const devData = {
                ...dev,
                isLocked: Boolean(dev.isLocked),
                dateEmission: new Date(dev.dateEmission),
                dateValidite: dev.dateValidite ? new Date(dev.dateValidite) : null,
                createdAt: new Date(dev.createdAt),
                updatedAt: new Date(dev.updatedAt),
                deletedAt: dev.deletedAt ? new Date(dev.deletedAt) : null
            };
            await prisma.devis.upsert({
                where: { id: dev.id },
                update: devData,
                create: devData
            });
        }
        console.log(`    ✅ ${devis.length} imported`);

        // 7. History
        console.log('  → History...');
        for (const entry of history) {
            const histData = {
                ...entry,
                timestamp: new Date(entry.timestamp)
            };
            await prisma.historyEntry.upsert({
                where: { id: entry.id },
                update: histData,
                create: histData
            });
        }
        console.log(`    ✅ ${history.length} imported`);

        db.close();
        await prisma.$disconnect();

        console.log('\n🎉 Migration terminée avec succès !');
        console.log('✅ Toutes vos données sont maintenant dans PostgreSQL (Neon)');

    } catch (error) {
        console.error('\n❌ Erreur:', error);
        db.close();
        await prisma.$disconnect();
        process.exit(1);
    }
}

migrateSQLiteToPostgres();
