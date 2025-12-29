
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("🔍 Debugging Quote Config Persistence...");

        // 0. Fetch valid Relation IDs
        const societe = await prisma.societe.findFirst();
        const client = await prisma.client.findFirst({ where: { societeId: societe?.id } });

        if (!societe || !client) {
            console.error("❌ Pre-requisites missing: Need at least 1 Societe and 1 Client.");
            return;
        }

        console.log(`Using Societe: ${societe.id}, Client: ${client.id}`);

        // 1. Create a Test Quote
        const configToSave = {
            showDateColumn: true,
            showTTCColumn: true,
            discountEnabled: true,
            discountType: 'pourcentage'
        };

        const quote = await prisma.devis.create({
            data: {
                numero: "TEST-CONFIG-001-" + Date.now(),
                societeId: societe.id,
                clientId: client.id,
                dateEmission: new Date(),
                dateValidite: new Date(),
                statut: "Brouillon",
                totalHT: 100,
                totalTTC: 120,
                itemsJSON: "[]",
                // Manually stringifying like the action does
                config: JSON.stringify(configToSave)
            }
        });

        console.log(`✅ Created Quote ID: ${quote.id}`);
        console.log(`Saved Config (Raw): ${quote.config}`);

        // 2. Fetch it back
        const fetched = await prisma.devis.findUnique({
            where: { id: quote.id }
        });

        if (!fetched) {
            console.error("❌ Failed to fetch quote back!");
            return;
        }

        console.log(`fetched.config type: ${typeof fetched.config}`);
        console.log(`fetched.config value: ${fetched.config}`);

        const parsed = JSON.parse(fetched.config || "{}");
        console.log("Parsed Config:", parsed);

        if (parsed.showDateColumn === true) {
            console.log("✅ Config persisted correctly!");
        } else {
            console.error("❌ Config NOT persisted correctly.");
        }

        // 3. Cleanup
        await prisma.devis.delete({ where: { id: quote.id } });
        console.log("🧹 Cleanup done.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

// Helper to find a valid client
async function getClient() {
    const c = await prisma.client.findFirst();
    return c?.id;
}

// Wrap logic to get client first
async function run() {
    const clientId = await getClient();
    if (!clientId) {
        console.log("No client found, skipping test.");
        return;
    }
    // inject client id into logic above... actually let's just use the first client found
    // rewriting main slightly in next step if needed, but for now I'll assume valid FK or handle error
}

main();
