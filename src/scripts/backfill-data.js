const fs = require('fs');
const path = require('path');
const Airtable = require('airtable');

// Load env vars manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/"/g, '');
    }
});

const apiKey = env.NEXT_PUBLIC_AIRTABLE_API_KEY || env.AIRTABLE_API_KEY;
const baseId = env.NEXT_PUBLIC_AIRTABLE_BASE_ID || env.AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
    console.error('Missing Airtable credentials in .env.local');
    process.exit(1);
}

Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

const TABLES = ['Clients', 'Produits', 'Factures', 'Devis'];

async function backfill() {
    console.log('Starting backfill using Company NAME "Euromedmultimedia"...');

    for (const tableName of TABLES) {
        console.log(`Processing ${tableName}...`);
        try {
            const records = await base(tableName).select().all();
            // Update ALL records that don't have a value, OR have the old 'soc_1' value
            const toUpdate = records.filter(r => {
                const val = r.get('SocieteID');
                return !val || val === 'soc_1';
            });

            console.log(`Found ${toUpdate.length} records to update in ${tableName}`);

            // Batches of 10
            for (let i = 0; i < toUpdate.length; i += 10) {
                const batch = toUpdate.slice(i, i + 10).map(r => ({
                    id: r.id,
                    fields: { 'SocieteID': 'Euromedmultimedia' }
                }));

                await base(tableName).update(batch);
                process.stdout.write('.');
            }
            console.log('\nDone.');
        } catch (err) {
            console.error(`Error in ${tableName}:`, err);
        }
    }
    console.log('Backfill complete!');
}

backfill();
