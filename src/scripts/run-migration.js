const { PrismaClient } = require('@prisma/client');
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');

// 1. Manually load .env.local to ensure Keys are found
const envPath = path.resolve(process.cwd(), '.env.local');
let env = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            env[key.trim()] = value.trim().replace(/"/g, '');
        }
    });
}

const apiKey = env.NEXT_PUBLIC_AIRTABLE_API_KEY || env.AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
const baseId = env.NEXT_PUBLIC_AIRTABLE_BASE_ID || env.AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
    console.error("❌ ERROR: Missing Airtable credentials in .env.local");
    console.error("Please add NEXT_PUBLIC_AIRTABLE_API_KEY and NEXT_PUBLIC_AIRTABLE_BASE_ID");
    process.exit(1);
}

const prisma = new PrismaClient();
Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

async function main() {
    console.log("🚀 Starting Migration from Airtable to Local SQLite...");

    // 2. Ensure Companies Exist
    console.log("\n🏢 checking Companies...");
    // (We assume seeded, but let's upsert just in case)
    const companies = [
        { id: "Euromedmultimedia", nom: "Euromedmultimedia", pays: "France" },
        { id: "Studio Urban", nom: "Studio Urban", pays: "France" }
    ];
    for (const c of companies) {
        // Use updateMany/create logic or simple find check to avoid overwriting recent seed changes
        const exists = await prisma.societe.findUnique({ where: { id: c.id } });
        if (!exists) {
            await prisma.societe.create({ data: { ...c, tvaIntra: "", siret: "" } }); // minimal create
        }
    }

    // 3. Migrate Clients
    console.log("\n👥 Migrating Clients...");
    try {
        const atClients = await base('Clients').select().all();
        console.log(`Found ${atClients.length} clients in Airtable.`);

        for (const r of atClients) {
            let societeId = r.get('SocieteID');
            if (!societeId || (societeId !== "Euromedmultimedia" && societeId !== "Studio Urban")) {
                societeId = "Euromedmultimedia";
            }

            const data = {
                id: r.id,
                societeId: societeId,
                nom: r.get('Nom') || "Client sans nom",
                email: r.get('Email'),
                telephone: r.get('Téléphone'),
                adresse: r.get('Adresse'),
                codePostal: r.get('Code Postal') ? String(r.get('Code Postal')) : undefined,
                ville: r.get('Ville'),
                pays: r.get('Pays'),
                siret: r.get('SIRET'),
                tvaIntra: r.get('TVA')
            };

            await prisma.client.upsert({
                where: { id: r.id },
                update: data,
                create: data
            });
        }
    } catch (e) {
        console.error("Skipping Clients (Error or Table not found):", e.message);
    }

    // 4. Migrate Products
    console.log("\n📦 Migrating Products...");
    try {
        const atProducts = await base('Produits').select().all();
        console.log(`Found ${atProducts.length} products in Airtable.`);
        for (const r of atProducts) {
            let societeId = r.get('SocieteID');
            if (!societeId || (societeId !== "Euromedmultimedia" && societeId !== "Studio Urban")) societeId = "Euromedmultimedia";

            const data = {
                id: r.id,
                societeId: societeId,
                nom: r.get('Nom') || "Produit sans nom",
                description: r.get('Description'),
                prixUnitaire: r.get('Prix Unitaire') || 0,
                tva: Number(r.get('TVA')) || 20
            };

            await prisma.produit.upsert({
                where: { id: r.id },
                update: data,
                create: data
            });
        }
    } catch (e) { console.error("Skipping Products:", e.message); }

    // 5. Migrate Invoices
    console.log("\n📄 Migrating Invoices...");
    try {
        const atInvoices = await base('Factures').select().all();
        console.log(`Found ${atInvoices.length} invoices in Airtable.`);
        for (const r of atInvoices) {
            let societeId = r.get('SocieteID');
            if (!societeId || (societeId !== "Euromedmultimedia" && societeId !== "Studio Urban")) societeId = "Euromedmultimedia";

            const clientIdRaw = r.get('Client');
            const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
            if (!clientId) continue;

            // Verify client exists
            const clientExists = await prisma.client.findUnique({ where: { id: clientId } });
            if (!clientExists) continue;

            const data = {
                id: r.id,
                societeId: societeId,
                clientId: clientId,
                numero: r.get('Numéro') || "DRAFT",
                dateEmission: r.get('Date Émission') ? new Date(r.get('Date Émission')) : new Date(),
                statut: r.get('Statut') || "Brouillon",
                totalHT: r.get('Total HT') || 0,
                totalTTC: r.get('Total TTC') || 0,
                dateEcheance: r.get('Échéance') ? new Date(r.get('Échéance')) : null,
                itemsJSON: r.get('ItemsJSON') || "[]"
            };

            await prisma.facture.upsert({
                where: { id: r.id },
                update: data,
                create: data
            });
        }
    } catch (e) { console.error("Skipping Invoices:", e.message); }

    // 6. Migrate Quotes
    console.log("\n📝 Migrating Quotes...");
    try {
        const atQuotes = await base('Devis').select().all();
        console.log(`Found ${atQuotes.length} quotes in Airtable.`);
        for (const r of atQuotes) {
            let societeId = r.get('SocieteID');
            if (!societeId || (societeId !== "Euromedmultimedia" && societeId !== "Studio Urban")) societeId = "Euromedmultimedia";

            const clientIdRaw = r.get('Client');
            const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
            if (!clientId) continue;

            const clientExists = await prisma.client.findUnique({ where: { id: clientId } });
            if (!clientExists) continue;

            const data = {
                id: r.id,
                societeId: societeId,
                clientId: clientId,
                numero: r.get('Numéro') || "DRAFT",
                dateEmission: r.get('Date Émission') ? new Date(r.get('Date Émission')) : new Date(),
                statut: r.get('Statut') || "Brouillon",
                totalHT: r.get('Total HT') || 0,
                totalTTC: r.get('Total TTC') || 0,
                itemsJSON: r.get('ItemsJSON') || "[]",
                dateValidite: r.get('Date Validité') ? new Date(r.get('Date Validité')) : null
            };

            await prisma.devis.upsert({
                where: { id: r.id },
                update: data,
                create: data
            });
        }
    } catch (e) { console.error("Skipping Quotes:", e.message); }

    console.log("\n✅ Migration Complete!");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
