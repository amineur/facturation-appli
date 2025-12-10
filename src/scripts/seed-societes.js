const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEED_SOCIETES = [
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
        cgv: "Conditions Générales de Vente...",

        // Branding
        primaryColor: "#6D28D9", // Purple
        secondaryColor: "#1e1e2e",

        // Settings
        defaultTva: 20,
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
        primaryColor: "#0ea5e9", // Blue
        secondaryColor: "#0f172a",

        // Settings
        defaultTva: 20,
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
    }
];

async function main() {
    console.log("Seeding Database...");

    for (const data of SEED_SOCIETES) {
        const existing = await prisma.societe.findUnique({ where: { id: data.id } });
        if (!existing) {
            console.log(`Creating ${data.nom}...`);
            await prisma.societe.create({ data });
        } else {
            console.log(`${data.nom} already exists. Updating...`);
            await prisma.societe.update({ where: { id: data.id }, data });
        }
    }

    console.log("Seeding completed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
