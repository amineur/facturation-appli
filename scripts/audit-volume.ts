
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("=== DB VOLUME AUDIT ===");

    const invoiceCount = await prisma.facture.count();
    const quoteCount = await prisma.devis.count();
    const productCount = await prisma.produit.count();
    const clientCount = await prisma.client.count();

    console.log(`Invoices: ${invoiceCount}`);
    console.log(`Quotes:   ${quoteCount}`);
    console.log(`Products: ${productCount}`);
    console.log(`Clients:  ${clientCount}`);
    console.log("=======================");
}

main();
