
const { PrismaClient } = require('@prisma/client');
async function main() {
    const prisma = new PrismaClient();
    try {
        const inv = await prisma.facture.findUnique({
            where: { numero: "20180261" }, // La facture de 100 unités
            select: {
                numero: true,
                dateEmission: true,
                datePaiement: true,
                statut: true
            }
        });
        console.log(inv);
    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
main();
