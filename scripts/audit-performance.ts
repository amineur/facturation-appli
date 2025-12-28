
import { PrismaClient } from '@prisma/client';
import { fetchInvoiceDetails } from '@/lib/actions/invoices';

const prisma = new PrismaClient();

async function main() {
    console.log("=== PERFORMANCE AUDIT: fetchInvoiceDetails ===");

    // 1. Get a valid ID
    const inv = await prisma.facture.findFirst({ select: { id: true } });
    if (!inv) {
        console.log("No invoices to test.");
        return;
    }
    const id = inv.id;
    console.log(`Target Invoice ID: ${id}`);

    // 2. Warm up (optional, but realistic for hot server)
    console.log("Warming up...");
    await fetchInvoiceDetails(id);

    // 3. Measure multiple runs
    const runs = 5;
    let total = 0;

    console.log(`Running ${runs} benchmarks...`);
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        await fetchInvoiceDetails(id);
        const end = performance.now();
        const duration = end - start;
        console.log(`Run ${i + 1}: ${duration.toFixed(2)}ms`);
        total += duration;
    }

    console.log("-------------------------------------------");
    console.log(`Average: ${(total / runs).toFixed(2)}ms`);
    console.log("=== END AUDIT ===");
}

main();
