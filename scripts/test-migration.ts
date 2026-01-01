import { PrismaClient } from '@prisma/client';
import { createTemplateSociete, migrateTemplateToReal } from '../src/lib/actions/template-societe';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Migration Test...");

    // 1. Create a dummy user
    const email = `test-user-${Date.now()}@example.com`;
    console.log(`Creating user: ${email}`);

    const user = await prisma.user.create({
        data: {
            email,
            password: "hash",
            fullName: "Test User"
        }
    });

    try {
        // 2. Create Template Societe
        console.log("Creating Template Societe...");
        const template = await createTemplateSociete(user.id);
        if (!template || !(template as any).isTemplate) {
            throw new Error("Failed to create template societe or isTemplate is false");
        }
        console.log("Template created:", template.id);

        // 3. Add some dummy data to the template
        console.log("Adding dummy data (Client, Facture)...");
        const client = await prisma.client.create({
            data: {
                nom: "Client Demo",
                email: "client@demo.com",
                societeId: template.id
            }
        });

        const invoice = await prisma.facture.create({
            data: {
                numero: "F-DEMO-001",
                statut: "DRAFT",
                dateEmission: new Date(),
                dateEcheance: new Date(),
                societeId: template.id,
                clientId: client.id,
                totalHT: 100,
                totalTTC: 120
            }
        });
        console.log("Dummy data created.");

        // 4. Test Keep Data Migration
        console.log("Testing data migration (Keep Data)...");
        const result = await migrateTemplateToReal(
            user.id,
            {
                nom: "Real Society Inc.",
                adresse: "123 Real St",
                codePostal: "75000",
                ville: "Paris",
            },
            true // Keep Data
        );

        if (!result.success || !result.data) {
            throw new Error("Migration failed: " + result.error);
        }
        const realSociete = result.data;

        console.log("Real Societe created:", realSociete.id);

        // Verify Data Transfer
        const movedClient = await prisma.client.findUnique({ where: { id: client.id } });
        const movedInvoice = await prisma.facture.findUnique({ where: { id: invoice.id } });

        if (movedClient?.societeId !== realSociete.id) throw new Error("Client was not moved to new society");
        if (movedInvoice?.societeId !== realSociete.id) throw new Error("Invoice was not moved to new society");

        console.log("SUCCESS: Data successfully migrated.");

        // Cleanup
        console.log("Cleaning up...");
        await prisma.facture.delete({ where: { id: invoice.id } });
        await prisma.client.delete({ where: { id: client.id } });
        await prisma.societe.delete({ where: { id: realSociete.id } });
        await prisma.user.delete({ where: { id: user.id } });

    } catch (e) {
        console.error("Test Failed:", e);
        // Attempt cleanup
        await prisma.user.deleteMany({ where: { email } });
    } finally {
        await prisma.$disconnect();
    }
}

main();
