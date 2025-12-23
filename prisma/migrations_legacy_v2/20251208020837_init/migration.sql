-- CreateTable
CREATE TABLE "Societe" (
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
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "societeId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "mobile" TEXT,
    "adresse" TEXT,
    "adresse2" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "pays" TEXT DEFAULT 'France',
    "siret" TEXT,
    "tvaIntra" TEXT,
    "notes" TEXT,
    "nomContact" TEXT,
    "prenomContact" TEXT,
    "titreContact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "societeId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prixUnitaire" REAL NOT NULL DEFAULT 0,
    "tva" REAL NOT NULL DEFAULT 20,
    "unite" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Produit_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "societeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateEmission" DATETIME NOT NULL,
    "dateEcheance" DATETIME,
    "datePaiement" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'Brouillon',
    "totalHT" REAL NOT NULL DEFAULT 0,
    "totalTTC" REAL NOT NULL DEFAULT 0,
    "itemsJSON" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Facture_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Facture_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "societeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateEmission" DATETIME NOT NULL,
    "dateValidite" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'Brouillon',
    "totalHT" REAL NOT NULL DEFAULT 0,
    "totalTTC" REAL NOT NULL DEFAULT 0,
    "itemsJSON" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Devis_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factureId" TEXT NOT NULL,
    "montant" REAL NOT NULL,
    "datePaiement" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moyenPaiement" TEXT,
    "reference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Paiement_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
