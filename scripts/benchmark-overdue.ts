
import { prisma } from '../src/lib/prisma';

async function benchmark() {
    console.log("Starting benchmark for updateOverdueInvoices (DB part only)...");
    const iterations = 10;
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const now = new Date();
        // Logic copied from src/app/actions.ts updateOverdueInvoices
        await prisma.facture.updateMany({
            where: {
                dateEcheance: { lt: now },
                statut: {
                    notIn: ["Payée", "Annulée", "Retard"]
                }
            },
            data: { statut: "Retard" }
        });
        const end = performance.now();
        const duration = end - start;
        console.log(`Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
        totalTime += duration;
    }

    console.log(`Average DB Execution Time: ${(totalTime / iterations).toFixed(2)}ms`);
    console.log("Note: This does NOT include 'revalidatePath' cost, which occurs in the Server Action.");
}

benchmark()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
