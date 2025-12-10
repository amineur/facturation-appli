import { Client, Devis, Facture, Produit, Societe, User } from "@/types";

export const MOCK_SOCIETES: Societe[] = [
    {
        id: "Euromedmultimedia",
        nom: "Euromedmultimedia",
        email: "compta@urbanhit.fr",
        adresse: "45 Avenue de la République",
        codePostal: "75011",
        ville: "Paris",
        pays: "France",
        telephone: "01 23 45 67 89",
        siret: "123 456 789 00012",
        tvaIntra: "FR12345678901",
        logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
        iban: "FR76 1234 5678 9012 3456 7890 123",
        bic: "PARIFR2",
        titulaireCompte: "Euromedmultimedia",
        mentionsLegales: "Euromedmultimedia - SAS au capital de 1000€ - 45 Avenue de la République 75011 Paris - SIRET: 12345678900012",
        cgv: `# Conditions générales de vente
12.09.2024

**1. Objet**
Les présentes conditions régissent les ventes de prestations de services de la société Euromedmultimedia.

Conformément à l'article 121-II de la loi n°2012-387 du 22 mars 2012 et au décret n°2012-1115 du 2 octobre 2012, une indemnité forfaitaire pour frais de recouvrement de 40 € est due au créancier en cas de retard de paiement.`,

        // Branding
        primaryColor: null,
        secondaryColor: null,

        // Settings
        defaultTva: 20,
        defaultConditions: "",
        currency: "EUR",
        invoicePrefix: "FAC-",
        quotePrefix: "DEV-",

        // Legal
        capitalSocial: "1000€",
        formeJuridique: "SAS",
        rcs: "Paris B 123 456 789",
        siteWeb: "https://euromed.com",
        banque: "Banque Populaire",

        // SMTP
        smtpHost: "smtp.urbanhit.fr",
        smtpPort: 587,
        smtpUser: "compta@urbanhit.fr",
        smtpPass: "secret",
        smtpSecure: true,
        smtpFrom: "compta@urbanhit.fr"
    },
    {
        id: "Studio Urban",
        nom: "Studio Urban",
        email: "compta@studiourban.fr",
        adresse: "123 Creative Avenue",
        codePostal: "75011",
        ville: "Paris",
        pays: "France",
        telephone: "09 87 65 43 21",
        siret: "999 999 999 00012",
        tvaIntra: "FR99999999901",
        iban: "FR76 9876 5432 1098 7654 3210 987",
        bic: "LBPFR2",
        titulaireCompte: "Studio Urban",
        mentionsLegales: "Studio Urban - SAS - 123 Creative Avenue 75011 Paris - SIRET: 999999999",
        cgv: "",
        logoUrl: "",

        // Branding
        primaryColor: null,
        secondaryColor: null,

        // Settings
        defaultTva: 20,
        defaultConditions: "",
        currency: "EUR",
        invoicePrefix: "FAC-",
        quotePrefix: "DEV-",

        // Legal
        capitalSocial: "5000€",
        formeJuridique: "SAS",
        rcs: "Paris B 999 999 999",
        siteWeb: "https://studiourban.fr",
        banque: "La Banque Postale",

        // SMTP
        smtpHost: "smtp.studiourban.fr",
        smtpPort: 587,
        smtpUser: "compta@studiourban.fr",
        smtpPass: "secret",
        smtpSecure: true,
        smtpFrom: "compta@studiourban.fr"
    },
];
export const MOCK_USERS: User[] = [
    {
        id: "usr_1",
        email: "amine@euromedmultimedia.com",
        fullName: "Amine Ben Abla",
        password: "admin",
        role: "admin",
        permissions: ["*"],
        societes: ["Euromedmultimedia", "Studio Urban"],
        currentSocieteId: "Euromedmultimedia"
    },
    {
        id: "usr_2",
        email: "user@glassy.com",
        fullName: "Collaborateur",
        password: "user",
        role: "user",
        permissions: ["read:invoices"],
        societes: ["Studio Urban"],
        currentSocieteId: "Studio Urban"
    }
];

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_PRODUITS: Produit[] = [];

export const MOCK_DEVIS: Devis[] = [];

export const MOCK_FACTURES: Facture[] = [];
