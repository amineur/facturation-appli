
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const userId = 'cmjrc5xii0000uly0x8fdhnbl'; // aminebenabla@gmail.com
    const societeId = 'cmjrd30os001h12srkmihtcmt'; // EUROMEDMULTIMEDIA...

    console.log(`Attaching user ${userId} to societe ${societeId}...`);

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

    console.log("Done! User attached and current context updated.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
