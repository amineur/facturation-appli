import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Charger .env explicitement
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("❌ Erreur de chargement du fichier .env:", result.error);
    process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
const directUrl = process.env.POSTGRES_URL_NON_POOLING;

console.log("🔍 Diagnostic de connexion Base de Données (Local)");
console.log("------------------------------------------------");
console.log(`📂 Fichier .env chargé: ${envPath}`);
console.log(`DATA_URL définie: ${dbUrl ? '✅ OUI' : '❌ NON'}`);
console.log(`DIRECT_URL définie: ${directUrl ? '✅ OUI' : '❌ NON'}`);

if (!dbUrl) {
    console.error("❌ DATABASE_URL manquante dans le .env local.");
    process.exit(1);
}

const prisma = new PrismaClient({
    datasourceUrl: dbUrl,
    log: ['error'], // Réduire le bruit, voir seulement les erreurs critiques
});

async function main() {
    console.log("⏳ Tentative de connexion à la base de données...");
    const start = Date.now();
    try {
        await prisma.$connect();
        const duration = Date.now() - start;
        console.log(`✅ Connexion réussie en ${duration}ms !`);
        
        console.log("⏳ Tentative de lecture (User count)...");
        const count = await prisma.user.count();
        console.log(`✅ Lecture réussie. Nombre d'utilisateurs: ${count}`);
        
        console.log("\n--- CONCLUSION ---");
        console.log("✅ Vos identifiants locaux fonctionnent.");
        console.log("👉 Si ça plante sur Vercel, c'est que ces variables n'ont pas été copiées dans les Settings Vercel.");
    } catch (e: any) {
        console.error("❌ ÉCHEC de connexion :");
        console.error(e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
