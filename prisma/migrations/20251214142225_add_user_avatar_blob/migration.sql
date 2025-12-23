-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "avatarUrl" TEXT,
    "avatarBytes" BLOB,
    "avatarMime" TEXT,
    "hasAvatar" BOOLEAN NOT NULL DEFAULT false,
    "currentSocieteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastReadHistory" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "societeId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HistoryEntry_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_SocieteMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_SocieteMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Societe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SocieteMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Devis" (
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
    "emailsJSON" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT,
    "notes" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Devis_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Devis" ("clientId", "conditions", "createdAt", "dateEmission", "dateValidite", "deletedAt", "id", "itemsJSON", "notes", "numero", "societeId", "statut", "totalHT", "totalTTC", "updatedAt") SELECT "clientId", "conditions", "createdAt", "dateEmission", "dateValidite", "deletedAt", "id", "itemsJSON", "notes", "numero", "societeId", "statut", "totalHT", "totalTTC", "updatedAt" FROM "Devis";
DROP TABLE "Devis";
ALTER TABLE "new_Devis" RENAME TO "Devis";
CREATE TABLE "new_Facture" (
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
    "emailsJSON" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    CONSTRAINT "Facture_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Facture_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Facture" ("clientId", "conditions", "createdAt", "dateEcheance", "dateEmission", "datePaiement", "deletedAt", "id", "itemsJSON", "notes", "numero", "societeId", "statut", "totalHT", "totalTTC", "updatedAt") SELECT "clientId", "conditions", "createdAt", "dateEcheance", "dateEmission", "datePaiement", "deletedAt", "id", "itemsJSON", "notes", "numero", "societeId", "statut", "totalHT", "totalTTC", "updatedAt" FROM "Facture";
DROP TABLE "Facture";
ALTER TABLE "new_Facture" RENAME TO "Facture";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_SocieteMembers_AB_unique" ON "_SocieteMembers"("A", "B");

-- CreateIndex
CREATE INDEX "_SocieteMembers_B_index" ON "_SocieteMembers"("B");
