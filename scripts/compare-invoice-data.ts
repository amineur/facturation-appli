import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function compareInvoiceData() {
    try {
        const invoice = await prisma.facture.findFirst({
            where: { numero: '20180266' },
            include: {
                items: true,
                client: { select: { nom: true } }
            }
        });

        if (!invoice) {
            console.log('❌ Invoice not found');
            return;
        }

        console.log('📋 Invoice:', invoice.numero);
        console.log('Client:', invoice.client.nom);
        console.log('\n' + '='.repeat(80) + '\n');

        // Parse itemsJSON
        const itemsFromJSON = JSON.parse(invoice.itemsJSON);
        console.log('📦 Items from itemsJSON:');
        console.log(JSON.stringify(itemsFromJSON, null, 2));

        console.log('\n' + '='.repeat(80) + '\n');

        // Show items from FactureItem table
        console.log('🗄️  Items from FactureItem table:');
        console.log(JSON.stringify(invoice.items, null, 2));

        console.log('\n' + '='.repeat(80) + '\n');

        // Compare
        console.log('🔍 COMPARISON:');
        console.log(`  itemsJSON count: ${itemsFromJSON.length}`);
        console.log(`  FactureItem count: ${invoice.items.length}`);

        if (itemsFromJSON.length !== invoice.items.length) {
            console.log('  ⚠️  COUNT MISMATCH!');
        }

        // Check for missing fields
        console.log('\n📊 Field Analysis:');
        itemsFromJSON.forEach((item: any, i: number) => {
            console.log(`\n  Item ${i + 1}:`);
            console.log(`    Has 'nom': ${!!item.nom}`);
            console.log(`    Has 'description': ${!!item.description}`);
            console.log(`    Has 'date': ${!!item.date}`);
            console.log(`    Has 'totalLigne': ${!!item.totalLigne}`);
            console.log(`    totalLigne value: ${item.totalLigne}`);
            console.log(`    montantHT value: ${item.montantHT}`);
        });

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

compareInvoiceData();
