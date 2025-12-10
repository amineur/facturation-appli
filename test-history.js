
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Testing direct DB insertion...");
    try {
        const user = await prisma.user.findUnique({ where: { id: "usr_1" } });
        if (!user) throw new Error("User usr_1 not found");
        console.log("User found:", user);

        const s = await prisma.societe.findUnique({ where: { id: "Euromedmultimedia" } });
        if (!s) throw new Error("Societe not found");
        console.log("Societe found:", s);

        const res = await prisma.historyEntry.create({
            data: {
                userId: "usr_1",
                action: "test",
                entityType: "debug",
                description: "Test insertion script",
                societeId: "Euromedmultimedia"
            }
        });
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
