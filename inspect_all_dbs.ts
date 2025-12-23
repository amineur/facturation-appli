import { PrismaClient } from '@prisma/client';

async function inspectDB(url: string, label: string) {
    console.log(`\n=== ${label} ===`);
    console.log(`URL: ${url}`);
    try {
        const prisma = new PrismaClient({ datasources: { db: { url } } });
        const counts = {
            societes: await prisma.societe.count(),
            users: await prisma.user.count(),
            factures: await prisma.facture.count(),
            devis: await prisma.devis.count(),
            clients: await prisma.client.count()
        };
        console.log(counts);
        await prisma.$disconnect();
        return counts;
    } catch (error: any) {
        console.log(`ERROR: ${error.message}`);
        return null;
    }
}

async function main() {
    // Base actuelle (celle qui a été reset)
    await inspectDB('file:./prisma/dev.db', 'BASE ACTUELLE (prisma/dev.db)');

    // Tentative d'inspection des bases anciennes
    // Les noms de fichiers semblent corrompus, essayons de les lire quand même
    await inspectDB('file:./prisma/dev.db"DATABASE_URL="file:./dev.db', 'BASE ANCIENNE 1 (prisma/)');
    await inspectDB('file:./dev.db"DATABASE_URL="file:./dev.db', 'BASE ANCIENNE 2 (racine)');
}

main().catch(console.error);
