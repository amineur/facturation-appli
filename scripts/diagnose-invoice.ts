import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseInvoice() {
    try {
        console.log('🔍 Fetching most recent invoice...\n');

        // Get the most recent invoice
        const invoice = await prisma.facture.findFirst({
            orderBy: { createdAt: 'desc' },
            include: {
                client: { select: { nom: true } }
            }
        });

        if (!invoice) {
            console.log('❌ No invoices found in database');
            return;
        }

        console.log('📋 Invoice Details:');
        console.log('  ID:', invoice.id);
        console.log('  Numero:', invoice.numero);
        console.log('  Client:', invoice.client.nom);
        console.log('  Statut:', invoice.statut);
        console.log('  Created:', invoice.createdAt);
        console.log('\n' + '='.repeat(60) + '\n');

        // Test itemsJSON parsing
        console.log('📦 Testing itemsJSON parsing:');
        console.log('  Raw value:', invoice.itemsJSON);
        console.log('  Type:', typeof invoice.itemsJSON);
        console.log('  Length:', invoice.itemsJSON?.length || 0);

        try {
            const items = JSON.parse(invoice.itemsJSON);
            console.log('  ✅ Parse successful');
            console.log('  Parsed type:', typeof items);
            console.log('  Is array:', Array.isArray(items));
            console.log('  Items count:', Array.isArray(items) ? items.length : 'N/A');
            if (Array.isArray(items) && items.length > 0) {
                console.log('  First item keys:', Object.keys(items[0]));
            }
        } catch (e: any) {
            console.log('  ❌ Parse failed:', e.message);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test emailsJSON parsing
        console.log('📧 Testing emailsJSON parsing:');
        console.log('  Raw value:', invoice.emailsJSON);
        console.log('  Type:', typeof invoice.emailsJSON);

        try {
            const emails = JSON.parse(invoice.emailsJSON);
            console.log('  ✅ Parse successful');
            console.log('  Parsed type:', typeof emails);
            console.log('  Is array:', Array.isArray(emails));
        } catch (e: any) {
            console.log('  ❌ Parse failed:', e.message);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test config parsing
        console.log('⚙️  Testing config parsing:');
        console.log('  Raw value:', invoice.config);
        console.log('  Type:', typeof invoice.config);

        try {
            const config = JSON.parse(invoice.config);
            console.log('  ✅ First parse successful');
            console.log('  Parsed type:', typeof config);

            // Test double-parse (as in the code)
            if (typeof config === 'string') {
                console.log('  🔄 Config is a string, attempting second parse...');
                try {
                    const config2 = JSON.parse(config);
                    console.log('  ✅ Second parse successful');
                    console.log('  Final type:', typeof config2);
                } catch (e: any) {
                    console.log('  ❌ Second parse failed:', e.message);
                }
            } else {
                console.log('  ℹ️  Config is not a string, no second parse needed');
                console.log('  Config keys:', Object.keys(config));
            }
        } catch (e: any) {
            console.log('  ❌ First parse failed:', e.message);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test the full fetchInvoiceDetails logic
        console.log('🧪 Simulating fetchInvoiceDetails logic:\n');

        try {
            let items = [];
            let emails = [];

            try {
                if (invoice.itemsJSON) items = JSON.parse(invoice.itemsJSON);
                if (invoice.emailsJSON) emails = JSON.parse(invoice.emailsJSON);
            } catch (e) {
                console.error('  ⚠️  Error parsing JSON fields:', e);
                items = [];
                emails = [];
            }

            const mapped = {
                id: invoice.id,
                numero: invoice.numero,
                clientId: invoice.clientId,
                societeId: invoice.societeId,
                dateEmission: invoice.dateEmission.toISOString(),
                echeance: invoice.dateEcheance ? invoice.dateEcheance.toISOString() : "",
                statut: invoice.statut,
                totalHT: invoice.totalHT,
                totalTTC: invoice.totalTTC,
                datePaiement: invoice.datePaiement ? invoice.datePaiement.toISOString() : undefined,
                items: items,
                emails: emails,
                type: "Facture",
                createdAt: invoice.createdAt ? invoice.createdAt.toISOString() : undefined,
                updatedAt: invoice.updatedAt ? invoice.updatedAt.toISOString() : undefined,
                isLocked: invoice.isLocked,
                archivedAt: invoice.archivedAt ? invoice.archivedAt.toISOString() : undefined,
                config: (() => {
                    if (!invoice.config) return {};
                    try {
                        const parsed = JSON.parse(invoice.config);
                        return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
                    } catch {
                        return {};
                    }
                })()
            };

            console.log('  ✅ Mapping successful');
            console.log('  Items count:', mapped.items.length);
            console.log('  Emails count:', mapped.emails.length);
            console.log('  Config keys:', Object.keys(mapped.config));

        } catch (error: any) {
            console.log('  ❌ Mapping failed:', error.message);
            console.log('  Stack:', error.stack);
        }

    } catch (error: any) {
        console.error('❌ Fatal error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

diagnoseInvoice();
