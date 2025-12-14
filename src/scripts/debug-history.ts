
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- SOCIETES ---");
    const societes = await prisma.societe.findMany();
    for (const s of societes) {
        console.log(`ID: ${s.id} | Nom: ${s.nom}`);
        const historyCount = await prisma.historyEntry.count({
            where: { societeId: s.id }
        });
        console.log(`   -> History Entries: ${historyCount}`);
    }

    console.log("\n--- HISTORY ENTRIES (Total) ---");
    const total = await prisma.historyEntry.count();
    console.log(`Total: ${total}`);

    console.log("\n--- HISTORY ENTRIES (Sample without valid Societe Link?) ---");
    // Check for entries with societeId that doesn't match a known societe
    const entries = await prisma.historyEntry.findMany({ take: 10 });
    for (const e of entries) {
        console.log(`ID: ${e.id} | Action: ${e.action} | SocieteID: ${e.societeId}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
