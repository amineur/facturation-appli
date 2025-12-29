
async function testDynamicImport() {
    const INVOICE_ID = 'cmjr8x22i00027y1r7o9awz6e';

    console.log(`🚀 Testing DYNAMIC import for ID: ${INVOICE_ID}`);

    try {
        // Simulate the import exactly as in page.tsx
        // Note: in ts-node/tsx we use relative path, but structure matches
        const { fetchInvoiceDetails } = await import('../src/app/actions');

        if (!fetchInvoiceDetails) {
            console.error("❌ fetchInvoiceDetails is UNDEFINED in import!");
            return;
        }

        console.log("✅ Import successful. Type:", typeof fetchInvoiceDetails);

        const result = await fetchInvoiceDetails(INVOICE_ID);

        if (result.success) {
            console.log('✅ Execution Success!');
        } else {
            console.log('❌ Execution Failed!');
            console.log('Error:', result.error);
        }
    } catch (error: any) {
        console.error('💥 Crash during dynamic import/exec:');
        console.error(error);
    }
}

testDynamicImport();
