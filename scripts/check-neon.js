const { Client } = require('pg');

// Neon Connection String from backup
const connectionString = 'postgresql://neondb_owner:npg_QMd1Ayl0ELfY@ep-empty-forest-ad657xwq-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

const client = new Client({
    connectionString,
});

async function run() {
    try {
        console.log('Connecting to Neon...');
        await client.connect();
        console.log('Connected!');

        const tables = ['User', 'Client', 'Facture', 'Devis'];

        for (const table of tables) {
            try {
                const res = await client.query(`SELECT count(*) FROM "${table}"`);
                console.log(`${table} count:`, res.rows[0].count);
            } catch (e) {
                console.log(`${table} - Error/Not Found:`, e.message);
            }
        }

        await client.end();
    } catch (err) {
        console.error('Neon Error:', err.message);
        process.exit(1);
    }
}

run();
