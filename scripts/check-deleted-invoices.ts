
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDeleted() {
    try {
        const deletedInvoices = await prisma.facture.findMany({
            where: {
                deletedAt: {
                    not: null
                }
            },
            select: {
                id: true,
                numero: true,
                deletedAt: true,
                societeId: true
            }
        });
        console.log("Deleted Invoices found:", deletedInvoices.length);
        if (deletedInvoices.length > 0) {
            console.log("First 5:", deletedInvoices.slice(0, 5));
        }

        const allInvoices = await prisma.facture.count();
        console.log("Total Invoices:", allInvoices);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkDeleted();
