export const FRENCH_BANKS: Record<string, { name: string, bic: string }> = {
    // Grands Réseaux
    "30004": { name: "BNP PARIBAS", bic: "BNPARIPP" },
    "13135": { name: "BNP PARIBAS", bic: "BNPARIPP" },
    "30003": { name: "SOCIETE GENERALE", bic: "SOGEFRPP" },
    "30002": { name: "PROCL", bic: "CRLYPEWW" }, // LCL
    "16155": { name: "LCL", bic: "CRLYPEWW" },
    "30066": { name: "CIC", bic: "CMCIFRPP" },
    "20041": { name: "LA BANQUE POSTALE", bic: "LBPPFRPP" },
    "16255": { name: "LA BANQUE POSTALE", bic: "LBPPFRPP" },

    // Banques en Ligne / Neobanks
    "10907": { name: "BOURSORAMA", bic: "SOGEFRPP" },
    "16107": { name: "BOURSORAMA", bic: "SOGEFRPP" },
    "16006": { name: "FORTUNEO", bic: "ARKAFRPP" },
    "14505": { name: "ING DIRECT", bic: "INGBFRPP" },
    "11195": { name: "HELLO BANK", bic: "BNPARIPP" },
    "23605": { name: "AXA BANQUE", bic: "AXABFRPP" },
    "19499": { name: "QONTO", bic: "QONTFRPP" },
    "16598": { name: "SHINE", bic: "SOGEFRPP" },
    "21112": { name: "N26", bic: "N26GFRPP" },
    "21999": { name: "REVOLUT", bic: "REVOFRPP" },
    "13805": { name: "MONABANQ", bic: "CMCIFRPP" },
    "17515": { name: "CREDIT DU NORD", bic: "NORDJAPP" },

    // Credit Mutuel (Plage 1xxxx souvent partagée, BICs variés selon fédération)
    // On met un BIC générique ou le plus courant, l'utilisateur pourra corriger
    "10278": { name: "CREDIT MUTUEL", bic: "CMCIFRPP" },
    "10096": { name: "CREDIT MUTUEL", bic: "CMCIFRPP" },
    "15589": { name: "CREDIT MUTUEL", bic: "CMCIFRPP" },

    // Banques Populaires (Souvent 1xxxx)
    "11315": { name: "BANQUE POPULAIRE", bic: "POPUFRPP" },
    "12548": { name: "BANQUE POPULAIRE", bic: "POPUFRPP" },
    "10107": { name: "BANQUE POPULAIRE", bic: "POPUFRPP" },
    "17805": { name: "BANQUE POPULAIRE", bic: "POPUFRPP" },

    // Caisses d'Epargne (1xxxx)
    "11706": { name: "CAISSE D'EPARGNE", bic: "CEPAFRPP" },
    "16405": { name: "CAISSE D'EPARGNE", bic: "CEPAFRPP" },
    "13485": { name: "CAISSE D'EPARGNE", bic: "CEPAFRPP" },
    "18025": { name: "CAISSE D'EPARGNE", bic: "CEPAFRPP" },
    "12135": { name: "CAISSE D'EPARGNE", bic: "CEPAFRPP" },

    // Crédit Agricole (Plages très variées, souvent 1xxxx)
    // Difficile à mapper parfaitement sans base complète locale.
    // On ajoute qques codes communs.
    "11406": { name: "CREDIT AGRICOLE", bic: "AGRIFRPP" },
    "16125": { name: "CREDIT AGRICOLE", bic: "AGRIFRPP" },
    "18206": { name: "CREDIT AGRICOLE", bic: "AGRIFRPP" },

    // Autres
    "30056": { name: "HSBC FRANCE", bic: "HSBCFRPP" },
    "40031": { name: "SOCIETE MARSEILLAISE DE CREDIT", bic: "SMCTFRPP" },
    "30076": { name: "CREDIT INDUSTRIEL DE L'OUEST", bic: "CIOOFRPP" },
};

export function getBankDetails(iban: string) {
    // Strip spaces
    const clean = iban.replace(/\s/g, '').toUpperCase();

    // Check if French IBAN
    if (!clean.startsWith('FR') || clean.length < 10) return null;

    // Extract bank code (positions 5 to 10 in 1-based index -> 4 to 9 in 0-based)
    // FRkk bbbb b
    // 0123 4567 8
    const bankCode = clean.substring(4, 9);

    return FRENCH_BANKS[bankCode] || null;
}
