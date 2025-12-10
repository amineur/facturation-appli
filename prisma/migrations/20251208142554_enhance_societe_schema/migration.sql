-- AlterTable
ALTER TABLE "Devis" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN "deletedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Societe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "pays" TEXT DEFAULT 'France',
    "siret" TEXT,
    "tvaIntra" TEXT,
    "logoUrl" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "titulaireCompte" TEXT,
    "mentionsLegales" TEXT,
    "cgv" TEXT,
    "primaryColor" TEXT DEFAULT '#000000',
    "secondaryColor" TEXT,
    "defaultTva" REAL NOT NULL DEFAULT 20,
    "defaultConditions" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "invoicePrefix" TEXT DEFAULT 'FACT-',
    "quotePrefix" TEXT DEFAULT 'DEV-',
    "capitalSocial" TEXT,
    "formeJuridique" TEXT,
    "rcs" TEXT,
    "siteWeb" TEXT,
    "banque" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Societe" ("adresse", "bic", "cgv", "codePostal", "createdAt", "email", "iban", "id", "logoUrl", "mentionsLegales", "nom", "pays", "siret", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "telephone", "titulaireCompte", "tvaIntra", "updatedAt", "ville") SELECT "adresse", "bic", "cgv", "codePostal", "createdAt", "email", "iban", "id", "logoUrl", "mentionsLegales", "nom", "pays", "siret", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "telephone", "titulaireCompte", "tvaIntra", "updatedAt", "ville" FROM "Societe";
DROP TABLE "Societe";
ALTER TABLE "new_Societe" RENAME TO "Societe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
