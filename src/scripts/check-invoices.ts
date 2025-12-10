
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkInvoices() {
    try {
        const invoices = await prisma.facture.findMany({
            where: { deletedAt: null },
            orderBy: { dateEmission: 'desc' }
        });

        console.log(`Total Invoices in DB: ${invoices.length}`);
        console.log("---------------------------------------------------");
        console.log("Numero | Emission | Echeance | Statut | Total TTC | Overdue?");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let calculatedOverdueSum = 0;

        invoices.forEach(inv => {
            let isOverdue = false;
            if (inv.statut !== 'Payée' && inv.statut !== 'Annulée' && inv.dateEcheance) {
                const dueDate = new Date(inv.dateEcheance);
                dueDate.setHours(0, 0, 0, 0);
                if (dueDate < today) {
                    isOverdue = true;
                    calculatedOverdueSum += inv.totalTTC;
                }
            }

            console.log(`${inv.numero} | ${inv.dateEmission.toISOString().split('T')[0]} | ${inv.dateEcheance?.toISOString().split('T')[0] || 'N/A'} | ${inv.statut} | ${inv.totalTTC} | ${isOverdue}`);
        });

        console.log("---------------------------------------------------");
        console.log(`Calculated Overdue Sum (Server-Side Script): ${calculatedOverdueSum}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkInvoices();
