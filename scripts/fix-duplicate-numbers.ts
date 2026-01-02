import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDuplicateNumbers() {
    console.log('🔍 Searching for duplicate invoice and quote numbers...\n');

    // Find duplicate invoices
    const invoices = await prisma.facture.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, numero: true, createdAt: true }
    });

    const invoiceNumberMap = new Map<string, typeof invoices>();
    invoices.forEach(inv => {
        const existing = invoiceNumberMap.get(inv.numero) || [];
        existing.push(inv);
        invoiceNumberMap.set(inv.numero, existing);
    });

    const duplicateInvoices = Array.from(invoiceNumberMap.entries())
        .filter(([_, invs]) => invs.length > 1);

    // Find duplicate quotes
    const quotes = await prisma.devis.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, numero: true, createdAt: true }
    });

    const quoteNumberMap = new Map<string, typeof quotes>();
    quotes.forEach(quote => {
        const existing = quoteNumberMap.get(quote.numero) || [];
        existing.push(quote);
        quoteNumberMap.set(quote.numero, existing);
    });

    const duplicateQuotes = Array.from(quoteNumberMap.entries())
        .filter(([_, quotes]) => quotes.length > 1);

    console.log(`📊 Found ${duplicateInvoices.length} duplicate invoice numbers`);
    console.log(`📊 Found ${duplicateQuotes.length} duplicate quote numbers\n`);

    if (duplicateInvoices.length === 0 && duplicateQuotes.length === 0) {
        console.log('✅ No duplicates found! Database is clean.');
        return;
    }

    // Fix duplicate invoices
    let fixedInvoices = 0;
    for (const [numero, duplicates] of duplicateInvoices) {
        console.log(`\n🔧 Fixing invoice number: ${numero} (${duplicates.length} duplicates)`);

        // Keep the oldest one (first in array due to createdAt sort)
        const [original, ...toRenumber] = duplicates;
        console.log(`   ✓ Keeping original: ${original.id} (created: ${original.createdAt})`);

        // Renumber the rest
        for (const duplicate of toRenumber) {
            // Find next available number
            let nextNumber = parseInt(numero) + 1;
            while (invoiceNumberMap.has(nextNumber.toString().padStart(8, '0'))) {
                nextNumber++;
            }
            const newNumero = nextNumber.toString().padStart(8, '0');

            await prisma.facture.update({
                where: { id: duplicate.id },
                data: { numero: newNumero }
            });

            // Update map to track new number
            invoiceNumberMap.set(newNumero, [duplicate]);

            console.log(`   → Renumbered ${duplicate.id}: ${numero} → ${newNumero}`);
            fixedInvoices++;
        }
    }

    // Fix duplicate quotes
    let fixedQuotes = 0;
    for (const [numero, duplicates] of duplicateQuotes) {
        console.log(`\n🔧 Fixing quote number: ${numero} (${duplicates.length} duplicates)`);

        const [original, ...toRenumber] = duplicates;
        console.log(`   ✓ Keeping original: ${original.id} (created: ${original.createdAt})`);

        for (const duplicate of toRenumber) {
            let nextNumber = parseInt(numero) + 1;
            while (quoteNumberMap.has(nextNumber.toString().padStart(8, '0'))) {
                nextNumber++;
            }
            const newNumero = nextNumber.toString().padStart(8, '0');

            await prisma.devis.update({
                where: { id: duplicate.id },
                data: { numero: newNumero }
            });

            quoteNumberMap.set(newNumero, [duplicate]);

            console.log(`   → Renumbered ${duplicate.id}: ${numero} → ${newNumero}`);
            fixedQuotes++;
        }
    }

    console.log(`\n✅ Fixed ${fixedInvoices} duplicate invoices`);
    console.log(`✅ Fixed ${fixedQuotes} duplicate quotes`);
    console.log('\n🎉 Database cleanup complete!');
}

fixDuplicateNumbers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
