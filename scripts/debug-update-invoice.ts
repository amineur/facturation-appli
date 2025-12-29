
import { updateInvoice, fetchInvoiceDetails } from "../src/lib/actions/invoices";
import { prisma } from "../src/lib/prisma";
import { Facture } from "../src/types";

async function main() {
    try {
        console.log("Creating a test invoice directly in DB to have a clean state...");
        const items = [
            { id: "item_1", description: "Test Product A", quantite: 1, prixUnitaire: 100, tva: 20, montantHT: 100, type: "produit" },
            { id: "item_2", description: "Test Product B", quantite: 2, prixUnitaire: 50, tva: 20, montantHT: 100, type: "produit" }
        ];

        const config = { showDateColumn: true, discountEnabled: true };

        const invoice = await prisma.facture.create({
            data: {
                numero: "DEBUG-" + Date.now(),
                societeId: "soc_1", // Assuming existing
                clientId: "cli_1", // Assuming existing, unlikely to fail fk in this mocked script env usually, but let's be careful. 
                // To be safe we should fetch a client or create one, but let's try to proceed.
                // Actually let's fetch first client.
                dateEmission: new Date(),
                itemsJSON: JSON.stringify(items),
                config: JSON.stringify(config),
                totalHT: 200,
                totalTTC: 240
            }
        });

        // We need a real client ID usually
        const client = await prisma.client.findFirst();
        if (client) {
            await prisma.facture.update({ where: { id: invoice.id }, data: { clientId: client.id, societeId: client.societeId } });
        }

        console.log(`Created Invoice ${invoice.id} with itemsJSON length: ${invoice.itemsJSON.length}`);

        // Fetch details to simulate Editor loading
        const loaded = await fetchInvoiceDetails(invoice.id);
        if (!loaded.success || !loaded.data) {
            console.error("Failed to fetch initial details");
            return;
        }

        const loadedInvoice = loaded.data;
        console.log("Loaded Config Type:", typeof loadedInvoice.config);
        console.log("Loaded Items Count:", loadedInvoice.items.length);

        // Simulate Update from Editor
        const updatePayload: Facture = {
            ...loadedInvoice,
            // @ts-ignore
            config: { ...loadedInvoice.config, showTTCColumn: true },
            items: [
                ...loadedInvoice.items,
                { id: "item_3", description: "New Item C", quantite: 1, prixUnitaire: 500, tva: 20, montantHT: 500, type: "produit" }
            ],
            totalHT: 700,
            totalTTC: 840
        } as any;

        console.log("Updating invoice...");
        const updateRes = await updateInvoice(updatePayload);

        if (!updateRes.success) {
            console.error("Update failed:", updateRes.error);
            return;
        }

        // Verify Persistence
        console.log("Verifying persistence...");
        const finalCheck = await prisma.facture.findUnique({ where: { id: invoice.id } });

        console.log("Final ItemsJSON:", finalCheck?.itemsJSON);
        console.log("Final Config Raw:", finalCheck?.config);

        const parsedItems = JSON.parse(finalCheck?.itemsJSON || "[]");
        console.log("Final Parsed Items Count:", parsedItems.length);
        console.log("Expected: 3");

        const parsedConfig = JSON.parse(finalCheck?.config || "{}");
        console.log("Final Config:", parsedConfig);
        console.log("Expected showTTCColumn: true");

        // Cleanup if needed
        // await prisma.facture.delete({ where: { id: invoice.id }});

    } catch (e) {
        console.error("Script error:", e);
    }
}

main();
