const { Client } = require('pg');

// Neon Connection String from .env.local (Production)
const connectionString = 'postgresql://neondb_owner:npg_3LJsiIxAl4nc@ep-morning-tree-adxvwvn3-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

const client = new Client({
    connectionString,
});

async function run() {
    try {
        console.log('Connecting to Neon...');
        await client.connect();

        // List tables
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

        console.log('Tables found:', res.rows.map(r => r.table_name));

        // Check count for each found table
        for (const row of res.rows) {
            const tableName = row.table_name;
            try {
                const countRes = await client.query(`SELECT count(*) FROM "${tableName}"`);
                console.log(`${tableName}: ${countRes.rows[0].count} rows`);
            } catch (e) {
                console.log(`${tableName}: Error counting - ${e.message}`);
            }
        }

        await client.end();
    } catch (err) {
        console.error('Neon Error:', err.message);
        process.exit(1);
    }
}

run();
