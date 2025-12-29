
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Correct User ID for amine@urbanhit.fr (found in previous logs)
    const userId = 'cmjm30rla0000711ia3y7yqsf';
    const societeId = 'cmjrd30os001h12srkmihtcmt'; // EUROMEDMULTIMEDIA...

    console.log(`Attaching CORRECT user ${userId} (amine@urbanhit.fr) to societe ${societeId}...`);

    await prisma.societe.update({
        where: { id: societeId },
        data: {
            members: {
                connect: { id: userId }
            }
        }
    });

    await prisma.user.update({
        where: { id: userId },
        data: { currentSocieteId: societeId }
    });

    console.log("Done! User amine@urbanhit.fr attached to new society.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
