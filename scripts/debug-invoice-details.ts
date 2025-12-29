
import { fetchInvoiceDetails } from "@/lib/actions/invoices";
import { prisma } from "@/lib/prisma";

async function main() {
    try {
        console.log("Searching for an invoice...");
        const invoice = await prisma.facture.findFirst({
            where: { itemsJSON: { not: "" } },
            orderBy: { createdAt: "desc" }
        });

        if (!invoice) {
            console.log("No invoice found.");
            return;
        }

        console.log(`Found invoice: ${invoice.numero} (${invoice.id})`);
        console.log("Raw config from DB:", invoice.config);

        console.log("Fetching details via action...");
        const result = await fetchInvoiceDetails(invoice.id);

        if (result.success && result.data) {
            console.log("Result Config:", result.data.config);
            console.log("Result Config Type:", typeof result.data.config);
            console.log("Items count:", result.data.items?.length);
            if (result.data.items?.length > 0) {
                console.log("First Item keys:", Object.keys(result.data.items[0]));
                console.log("First Item date:", result.data.items[0].date);
            }
        } else {
            console.error("Error fetching details:", result.error);
        }

    } catch (e) {
        console.error("Script error:", e);
    }
}

main();
