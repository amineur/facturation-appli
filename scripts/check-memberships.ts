
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const memberships = await prisma.membership.findMany({
            include: { user: true, societe: true }
        });

        console.log(`Total Memberships: ${memberships.length}`);

        const map = new Map();
        const duplicates = [];

        for (const m of memberships) {
            const key = `${m.userId}-${m.societeId}`;
            if (map.has(key)) {
                duplicates.push(m);
            } else {
                map.set(key, true);
            }
            console.log(`[${m.societe.nom}] ${m.user.email} - ${m.role}`);
        }

        if (duplicates.length > 0) {
            console.error("DUPLICATES FOUND:", duplicates.length);
            console.table(duplicates);
        } else {
            console.log("No duplicate memberships found.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
