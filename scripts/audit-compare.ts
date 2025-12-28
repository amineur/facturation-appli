
import { PrismaClient } from '@prisma/client';
import { fetchInvoiceDetails } from '@/lib/actions/invoices';
import { fetchInvoicesLite } from '@/lib/actions/invoices';

const prisma = new PrismaClient();

async function main() {
    console.log("=== COMPARATIVE BENCHMARK ===");

    // 1. Get a valid ID
    const inv = await prisma.facture.findFirst({ select: { id: true, societeId: true } });
    if (!inv) { console.log("No data."); return; }

    const id = inv.id;
    const societeId = inv.societeId;

    // Warmup
    await fetchInvoicesLite(societeId);

    const runs = 5;
    let totalLite = 0;
    let totalDetail = 0;

    console.log(`Running ${runs} passes...`);

    for (let i = 0; i < runs; i++) {
        const startLite = performance.now();
        await fetchInvoicesLite(societeId);
        const mid = performance.now();
        await fetchInvoiceDetails(id);
        const end = performance.now();

        const liteDuration = mid - startLite;
        const detailDuration = end - mid;

        console.log(`Pass ${i + 1}: Lite=${liteDuration.toFixed(0)}ms, Detail=${detailDuration.toFixed(0)}ms`);

        totalLite += liteDuration;
        totalDetail += detailDuration;
    }

    console.log("-----------------------");
    console.log(`Avg Lite:   ${(totalLite / runs).toFixed(0)}ms`);
    console.log(`Avg Detail: ${(totalDetail / runs).toFixed(0)}ms`);
    console.log("=======================");
}

main();
