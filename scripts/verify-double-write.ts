
import { createInvoice } from '../src/lib/actions/invoices';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Verifying Double Write...");

    // Mock an invoice
    const mockInvoice: any = {
        numero: "TEST-DW-001",
        dateEmission: new Date().toISOString(),
        statut: "Brouillon",
        totalHT: 100,
        totalTTC: 120,
        societeId: "Euromedmultimedia", // Assuming this exists or falls back
        clientId: "generic_client", // Needs a valid client ID. We should fetch one.
        items: [
            {
                nom: "Item 1",
                quantite: 1,
                prixUnitaire: 100,
                tva: 20
            }
        ]
    };

    // 1. Get a client
    const client = await prisma.client.findFirst();
    if (!client) {
        console.error("No clients found, can't verify.");
        return;
    }
    mockInvoice.clientId = client.id;
    mockInvoice.societeId = client.societeId;

    try {
        console.log("Creating Invoice...");
        // We use the ACTION, so it triggers the double write logic
        const result = await createInvoice(mockInvoice);

        if (!result.success || !result.id) {
            console.error("Create Invoice Action Failed:", result.error);
            return;
        }

        const invoiceId = result.id;
        console.log(`Invoice Created: ${invoiceId}`);

        // 2. Refresh from DB
        const dbInvoice = await prisma.facture.findUnique({
            where: { id: invoiceId },
            include: { items: true } // Relation
        });

        if (!dbInvoice) {
            console.error("Invoice not found in DB!");
            return;
        }

        // 3. Verify JSON
        const jsonItems = JSON.parse(dbInvoice.itemsJSON);
        console.log(`JSON Items Count: ${jsonItems.length}`);
        if (jsonItems.length !== 1) console.error("❌ JSON Write Failed");
        else console.log("✅ JSON Write OK");

        // 4. Verify Relation
        const tableItems = dbInvoice.items;
        console.log(`Table Items Count: ${tableItems.length}`);
        if (tableItems.length !== 1) console.error("❌ Table Write Failed");
        else console.log("✅ Table Write OK");

        // Cleanup
        await prisma.facture.delete({ where: { id: invoiceId } });
        console.log("Cleanup done.");

    } catch (e) {
        console.error("Verification Crashed:", e);
    }
}

main();
