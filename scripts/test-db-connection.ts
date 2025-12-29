// Script pour tester la connexion DB et afficher la config
import { prisma } from '../src/lib/prisma';

async function testConnection() {
    console.log('🔍 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')); // Masque le password

    const start = performance.now();

    try {
        await prisma.$connect();
        const connectTime = performance.now() - start;
        console.log(`✅ Connected in ${connectTime.toFixed(0)}ms`);

        // Test simple query
        const queryStart = performance.now();
        const count = await prisma.facture.count();
        const queryTime = performance.now() - queryStart;

        console.log(`✅ Query executed in ${queryTime.toFixed(0)}ms`);
        console.log(`📊 Factures count: ${count}`);

        await prisma.$disconnect();

        const total = performance.now() - start;
        console.log(`⏱️ Total time: ${total.toFixed(0)}ms`);

    } catch (error) {
        console.error('❌ Connection failed:', error);
    }
}

testConnection();
