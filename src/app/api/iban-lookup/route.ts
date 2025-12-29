import { NextRequest, NextResponse } from 'next/server';

// Local fallback database for common French banks
const FRENCH_BANKS: Record<string, { name: string, bic: string }> = {
    "30004": { name: "BNP PARIBAS", bic: "BNPAFRPP" },
    "30003": { name: "SOCIETE GENERALE", bic: "SOGEFRPP" },
    "30002": { name: "LCL", bic: "CRLYFRPP" },
    "30066": { name: "CIC", bic: "CMCIFRPP" },
    "20041": { name: "LA BANQUE POSTALE", bic: "PSSTFRPP" },
    "10907": { name: "BOURSORAMA", bic: "BOUSFRPP" },
    "16006": { name: "FORTUNEO", bic: "FTNOFRP1" },
    "14505": { name: "ING", bic: "INGBFRPP" },
    "11195": { name: "HELLO BANK", bic: "BNPAFRPP" },
    "19499": { name: "QONTO", bic: "QNTOFRP1" },
    "16598": { name: "SHINE", bic: "SABOROPP" },
    "10278": { name: "CREDIT MUTUEL", bic: "CMCIFR2A" },
    "11706": { name: "CAISSE D'EPARGNE", bic: "CEPAFRPP" },
    "11406": { name: "CREDIT AGRICOLE", bic: "AGRIFRPP" },
    "11315": { name: "BANQUE POPULAIRE", bic: "CCBPFRPP" },
    "28233": { name: "REVOLUT", bic: "REVOFRPP" },
    "10207": { name: "BANQUE POPULAIRE", bic: "CCBPFRPP" },
};

function getLocalBankDetails(iban: string) {
    const clean = iban.replace(/\s/g, '').toUpperCase();
    if (!clean.startsWith('FR') || clean.length < 14) return null;
    const bankCode = clean.substring(4, 9);
    return FRENCH_BANKS[bankCode] || null;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const iban = searchParams.get('iban');

    if (!iban || iban.length < 15) {
        return NextResponse.json({ success: false, error: 'IBAN trop court' });
    }

    const cleanIban = iban.replace(/\s/g, '').toUpperCase();

    // 1. Try local database first (faster)
    const localResult = getLocalBankDetails(cleanIban);
    if (localResult) {
        return NextResponse.json({
            success: true,
            source: 'local',
            data: {
                bankName: localResult.name,
                bic: localResult.bic
            }
        });
    }

    // 2. Try OpenIBAN API
    try {
        const response = await fetch(`https://openiban.com/validate/${cleanIban}?getBIC=true&validateBankCode=true`, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 86400 } // Cache for 24h
        });

        if (response.ok) {
            const data = await response.json();

            // Critical check: valid AND has a bank name
            if (data.valid && data.bankData && data.bankData.name) {
                return NextResponse.json({
                    success: true,
                    source: 'openiban',
                    data: {
                        bankName: data.bankData.name,
                        bic: data.bankData.bic || '',
                        city: data.bankData.city || '',
                        zip: data.bankData.zip || ''
                    }
                });
            }
        }
    } catch (error) {
        console.error('OpenIBAN API error:', error);
    }

    // 3. Try IBAN.com API as fallback
    try {
        const response = await fetch(`https://api.ibanapi.com/v1/validate/${cleanIban}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.result === 200 && data.data?.bank) {
                return NextResponse.json({
                    success: true,
                    source: 'ibanapi',
                    data: {
                        bankName: data.data.bank.bank_name || '',
                        bic: data.data.bank.bic || ''
                    }
                });
            }
        }
    } catch (error) {
        console.error('IBANAPI error:', error);
    }

    return NextResponse.json({
        success: false,
        error: 'Banque non trouvée. Veuillez saisir manuellement.'
    });
}
