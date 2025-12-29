import { fetchInvoiceDetails } from '../src/lib/actions/invoices';

async function testRealFunction() {
    const INVOICE_ID = 'cmjr8x22i00027y1r7o9awz6e'; // ID de la facture problématique

    console.log(`🚀 Testing fetchInvoiceDetails for ID: ${INVOICE_ID}`);

    try {
        const result = await fetchInvoiceDetails(INVOICE_ID);

        if (result.success) {
            console.log('✅ Success!');
            console.log('Data keys:', Object.keys(result.data || {}));
            console.log('Items count:', result.data?.items?.length);
        } else {
            console.log('❌ Failed!');
            console.log('Error:', result.error);
        }
    } catch (error: any) {
        console.error('💥 PROPER CRASH detected:');
        console.error(error);
    }
}

testRealFunction();
