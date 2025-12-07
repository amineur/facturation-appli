import { Client, Devis, Facture, Produit, Societe, User } from "@/types";

export const MOCK_SOCIETES: Societe[] = [
    {
        id: "soc_1",
        nom: "Euromedmultimedia",
        email: "compta@urbanhit.fr",
        adresse: "45 Avenue de la République",
        codePostal: "75011",
        ville: "Paris",
        telephone: "01 23 45 67 89",
        siret: "123 456 789 00012",
        tvaIntracom: "FR12345678901",
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
        smtpConfig: {
            host: "smtp.urbanhit.fr",
            port: 587,
            user: "compta@urbanhit.fr",
            pass: "secret",
            secure: true,
            fromName: "Compta Euromed",
            fromEmail: "compta@urbanhit.fr"
        }
    },
    {
        id: "soc_2",
        nom: "Studio Urban",
        email: "compta@studiourban.fr",
        adresse: "123 Creative Avenue",
        codePostal: "75011",
        ville: "Paris",
        telephone: "09 87 65 43 21",
        siret: "999 999 999 00012",
        tvaIntracom: "FR99999999901",
        iban: "FR76 9876 5432 1098 7654 3210 987",
        bic: "LBPFR2",
        titulaireCompte: "Studio Urban",
        mentionsLegales: "Studio Urban - SAS - 123 Creative Avenue 75011 Paris - SIRET: 999999999",
        logoUrl: "",
        smtpConfig: {
            host: "smtp.studiourban.fr",
            port: 587,
            user: "compta@studiourban.fr",
            pass: "secret",
            secure: true,
            fromName: "Compta Studio Urban",
            fromEmail: "compta@studiourban.fr"
        }
    },
];

export const MOCK_USERS: User[] = [
    {
        id: "usr_1",
        email: "admin@euromed.com",
        fullName: "Admin Euromed",
        role: "admin",
        permissions: ["*"],
        societes: ["soc_1", "soc_2"],
        currentSocieteId: "soc_1"
    }
];

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_PRODUITS: Produit[] = [];

export const MOCK_DEVIS: Devis[] = [];

export const MOCK_FACTURES: Facture[] = [];
