"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, FileText, Receipt, Database, AlertTriangle, Users, Package } from "lucide-react";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
// import { airtableService } from "@/lib/airtable-service"; // REMOVED
import {
    checkDatabaseConnection,
    importClient,
    importInvoice,
    importQuote,
    importProduct,
    deleteAllRecords // NEW
} from "@/app/actions"; // NEW Server Actions
import { StatusDevis, StatusFacture, Devis, Facture, Client, Produit } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function DataManagement({ onBack }: { onBack?: () => void }) {
    const { clients, refreshData, societe, invoices, quotes, products } = useData();
    const fileInputRefDevis = useRef<HTMLInputElement>(null);
    const fileInputRefFactures = useRef<HTMLInputElement>(null);
    const fileInputRefClients = useRef<HTMLInputElement>(null);
    const fileInputRefProduits = useRef<HTMLInputElement>(null);

    const checkConnection = async () => {
        const result = await checkDatabaseConnection();
        if (result.success) toast.success(result.message);
        else toast.error(result.message);
    };

    const handleReset = async () => {
        if (confirm("Êtes-vous sûr de vouloir réinitialiser toutes les données ? Cette action est irréversible.")) {
            // Reset all tables sequentially
            await deleteAllRecords('Factures');
            await deleteAllRecords('Devis');
            await deleteAllRecords('Clients');
            await deleteAllRecords('Produits');

            refreshData();
            toast.success("Données réinitialisées !");
        }
    };




    // ... (rest of shared utils unchanged) ...

    // --- SHARED UTILS (keeping cleanString, cleanAmount, parseFrenchNumber, parseCSVLine) ---
    const cleanString = (val: string) => {
        if (!val) return "";
        let cleaned = val.trim();
        if (cleaned.startsWith('="') && cleaned.endsWith('"')) cleaned = cleaned.slice(2, -1);
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
        return cleaned.trim();
    };

    const cleanAmount = (val: string) => {
        if (!val) return 0;
        let cleaned = cleanString(val);
        cleaned = cleaned.replace(/[\s\u00A0€$£]/g, "");
        if (cleaned.includes(".") && cleaned.includes(",")) {
            if (cleaned.indexOf(".") < cleaned.indexOf(",")) {
                cleaned = cleaned.replace(/\./g, "").replace(",", ".");
            } else {
                cleaned = cleaned.replace(/,/g, "");
            }
        } else if (cleaned.includes(",")) {
            cleaned = cleaned.replace(",", ".");
        }
        return parseFloat(cleaned) || 0;
    };

    const parseFrenchNumber = (str: string) => {
        if (!str) return 0;
        return parseFloat(str.replace(/\s/g, "").replace(",", ".")) || 0;
    };

    const parseCSVLine = (line: string, delimiter: string) => {
        const result = [];
        let start = 0;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === delimiter && !inQuotes) {
                result.push(line.substring(start, i));
                start = i + 1;
            }
        }
        result.push(line.substring(start));
        return result;
    };

    // --- DEVIS IMPORT ---
    const handleDevisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split("\n").filter(line => line.trim() !== "");
        const firstLine = lines[0] || "";
        const separator = firstLine.includes(";") ? ";" : ",";
        const dataRows = lines.slice(1);

        let importCount = 0;

        // Process sequentially to be nice to Airtable rate limits (5 req/s) if possible, or usually parallel is fine for small batches.
        // For better UX, we'll map.
        const promises = dataRows.map(async (rowStr) => {
            const row = parseCSVLine(rowStr, separator);
            if (row.length < 5) return;

            const numero = cleanString(row[0]);
            const clientName = cleanString(row[1]);
            const dateEmission = cleanString(row[2]);
            const dateValidite = cleanString(row[3]);
            const totalHT = cleanAmount(row[5]);
            const totalTTC = cleanAmount(row[6]);
            const rawStatus = row[7]?.trim();

            if (!numero || !clientName) return;

            let clientId = "";
            const existingClient = clients.find(c => c.nom.toLowerCase() === clientName.toLowerCase());
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const newClient: any = {
                    id: crypto.randomUUID(),
                    nom: clientName,
                    email: "",
                    statut: "Actif",
                    totalFactures: 0,
                    adresse: "",
                    codePostal: "",
                    ville: "",
                    societeId: "soc_1"
                };
                dataService.saveClient(newClient);
                clientId = newClient.id;
            }

            let statut: StatusDevis = "Brouillon";
            const lowerStatus = rawStatus?.toLowerCase() || "";
            if (lowerStatus.includes("accept") || lowerStatus.includes("sign")) statut = "Accepté";
            else if (lowerStatus.includes("refus")) statut = "Refusé";
            else if (lowerStatus.includes("envoy")) statut = "Envoyé";
            else if (lowerStatus.includes("convert") || lowerStatus.includes("factur")) statut = "Facturé";

            const newDevis: Devis = {
                id: crypto.randomUUID(),
                numero,
                clientId,
                societeId: "soc_1",
                dateEmission,
                dateValidite,
                statut,
                totalHT,
                totalTTC,
                items: [],
                type: "Devis"
            };

            dataService.saveQuote(newDevis);

            // Sync to Database via Server Action
            await importQuote(newDevis, clientName);
            importCount++;
        });

        await Promise.all(promises);

        refreshData();
        refreshData();
        toast.success(`${importCount} devis importés localement et synchronisation base de données lancée !`);
        if (fileInputRefDevis.current) fileInputRefDevis.current.value = "";
    };

    // --- FACTURES IMPORT ---
    const handleFacturesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split("\n").filter(line => line.trim() !== "");
        const firstLine = lines[0] || "";
        const separator = firstLine.includes(";") ? ";" : ",";
        const dataRows = lines.slice(1);

        let importCount = 0;
        const updatedClients = [...clients];

        const promises = dataRows.map(async (rowStr) => {
            const row = parseCSVLine(rowStr, separator);
            if (row.length < 5) return;

            const numero = cleanString(row[0]);
            const clientName = cleanString(row[1]);
            const dateEmission = cleanString(row[2]);
            const echeance = cleanString(row[3]);
            const datePaiement = cleanString(row[4]);
            const totalHT = cleanAmount(row[6]);
            const totalTTC = cleanAmount(row[7]);
            const rawStatus = row[8]?.trim();

            if (!numero || !clientName) return;

            let clientId = "";
            const existingClient = updatedClients.find(c => c.nom.toLowerCase() === clientName.toLowerCase());
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const newClient: any = {
                    id: crypto.randomUUID(),
                    nom: clientName,
                    email: "",
                    statut: "Actif",
                    totalFactures: 0,
                    adresse: "",
                    codePostal: "",
                    ville: "",
                    societeId: "soc_1"
                };
                dataService.saveClient(newClient);
                updatedClients.push(newClient);
                clientId = newClient.id;
            }

            let statut: StatusFacture = "Brouillon";
            const lowerStatus = rawStatus?.toLowerCase() || "";
            if (lowerStatus.includes("pay")) statut = "Payée";
            else if (lowerStatus.includes("retard")) statut = "Retard";
            else if (lowerStatus.includes("envoy")) statut = "Envoyée";
            else if (lowerStatus.includes("annul")) statut = "Annulée";

            const newInvoice: Facture = {
                id: crypto.randomUUID(),
                numero,
                clientId,
                societeId: "soc_1",
                dateEmission,
                echeance,
                datePaiement,
                statut,
                totalHT,
                totalTTC,
                items: [],
                type: "Facture"
            };

            dataService.saveInvoice(newInvoice);

            // Sync to Database via Server Action
            await importInvoice(newInvoice, clientName);
            importCount++;
        });

        await Promise.all(promises);

        refreshData();
        refreshData();
        toast.success(`${importCount} factures importées localement et synchronisation base de données lancée !`);
        if (fileInputRefFactures.current) fileInputRefFactures.current.value = "";
    };

    // --- CLIENTS IMPORT ---
    const handleClientsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split("\n");
        let count = 0;
        let startIndex = 0;

        if (lines[0].toLowerCase().includes("nom") || lines[0].toLowerCase().includes("siret")) {
            startIndex = 1;
        }

        const promises = [];

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(",").map(c => c.trim());
            let clientData: Partial<Client> = {};

            // (Previous parsing logic kept same)
            if (cols.length >= 14) {
                clientData = {
                    reference: cols[0],
                    nom: cols[1],
                    siret: cols[2],
                    tvaIntra: cols[3],
                    titreContact: cols[4],
                    prenomContact: cols[5],
                    nomContact: cols[6],
                    email: cols[7],
                    telephone: cols[8],
                    mobile: cols[9],
                    adresse: cols[10],
                    adresse2: cols[11],
                    codePostal: cols[12],
                    ville: cols[13],
                    pays: cols[14]
                };
            } else if (cols.length >= 5) {
                clientData = {
                    nom: cols[0],
                    email: cols[1],
                    telephone: cols[2],
                    adresse: cols[3],
                    codePostal: cols[4],
                    ville: cols[5]
                };
            }

            if (clientData.nom && clientData.email) {
                const newClient: Client = {
                    id: crypto.randomUUID(),
                    societeId: societe?.id || "soc_1",
                    nom: clientData.nom,
                    email: clientData.email,
                    telephone: clientData.telephone || "",
                    mobile: clientData.mobile || "",
                    adresse: clientData.adresse || "",
                    adresse2: clientData.adresse2 || "",
                    codePostal: clientData.codePostal || "",
                    ville: clientData.ville || "",
                    pays: clientData.pays || "France",
                    siret: clientData.siret || "",
                    tvaIntra: clientData.tvaIntra || "",
                    reference: clientData.reference || "",
                    nomContact: clientData.nomContact || "",
                    prenomContact: clientData.prenomContact || "",
                    titreContact: clientData.titreContact || ""
                };
                dataService.saveClient(newClient);

                // Sync to Database via Server Action
                promises.push(importClient(newClient));
                count++;
            }
        }

        await Promise.all(promises);

        refreshData();
        refreshData();
        toast.success(`${count} clients importés localement et synchronisation base de données lancée !`);
        if (fileInputRefClients.current) fileInputRefClients.current.value = "";
    };

    // --- PRODUITS IMPORT ---
    const handleProduitsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split("\n").filter(line => line.trim() !== "");
        const firstLine = lines[0] || "";
        const separator = firstLine.includes(";") ? ";" : ",";
        const dataRows = lines.slice(1);

        let importCount = 0;

        const promises = dataRows.map(async (rowStr) => {
            const row = parseCSVLine(rowStr, separator);
            const nom = cleanString(row[0] || "");
            const unite = cleanString(row[1] || "");
            const prixHT = parseFrenchNumber(cleanString(row[2] || "0"));
            const tva = parseFrenchNumber(cleanString(row[3] || "20"));

            if (!nom) return;

            const newProduct: Produit = {
                id: crypto.randomUUID(),
                nom,
                description: unite ? `Unité: ${unite}` : "",
                prixUnitaire: prixHT,
                tva,
                societeId: societe?.id || "soc_1"
            };

            dataService.saveProduct(newProduct);

            // Sync to Database via Server Action
            await importProduct(newProduct);
            importCount++;
        });

        await Promise.all(promises);

        refreshData();
        refreshData();
        toast.success(`${importCount} produits importés localement et synchronisation base de données lancée !`);
        if (fileInputRefProduits.current) fileInputRefProduits.current.value = "";
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-foreground">Gestion des données</h2>
                    <p className="text-muted-foreground">Importez vos données ou réinitialisez votre base.</p>
                </div>
                {onBack && (
                    <button onClick={onBack} className="text-sm text-blue-500 hover:text-blue-400">
                        Retour
                    </button>
                )}
            </div>

            <div className="w-full">
                <div className="flex items-center gap-2 mb-4">
                    <Database className="h-5 w-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Base de données</h3>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white mb-1">Connexion Serveur</p>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                <span className="text-xs text-green-400">Connecté (SQLite)</span>
                            </div>
                        </div>
                        <button
                            onClick={checkConnection}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-medium transition-colors border border-white/10"
                        >
                            Test Connexion
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div>
                            <p className="text-sm font-medium text-red-400">Zone de danger</p>
                            <p className="text-xs text-muted-foreground">Supprimer toutes les données de cette société</p>
                        </div>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors border border-red-500/20"
                        >
                            <Trash2 className="h-3 w-3" />
                            Tout supprimer
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* DEVIS SECTION */}
                <div className="glass-card p-6 rounded-2xl space-y-6 border border-white/10">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                            <FileText className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Devis</h3>
                            <p className="text-xs text-muted-foreground">{quotes.length} devis enregistrés</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRefDevis}
                                className="hidden"
                                onChange={handleDevisUpload}
                            />
                            <button
                                onClick={() => fileInputRefDevis.current?.click()}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
                            >
                                <Upload className="h-4 w-4" />
                                Importer CSV Devis
                            </button>
                        </div>

                        <button
                            onClick={async () => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUS les devis ?")) {
                                    const res = await deleteAllRecords('Devis');
                                    if (res.success) toast.success("Table Devis vidée !");
                                    else toast.error("Erreur suppression: " + res.error);
                                    refreshData();
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            Tout supprimer
                        </button>
                    </div>
                </div>

                {/* FACTURES SECTION */}
                <div className="glass-card p-6 rounded-2xl space-y-6 border border-white/10">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Receipt className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Factures</h3>
                            <p className="text-xs text-muted-foreground">{invoices.length} factures enregistrées</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRefFactures}
                                className="hidden"
                                onChange={handleFacturesUpload}
                            />
                            <button
                                onClick={() => fileInputRefFactures.current?.click()}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
                            >
                                <Upload className="h-4 w-4" />
                                Importer CSV Factures
                            </button>
                        </div>

                        <button
                            onClick={async () => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUTES les factures ?")) {
                                    const res = await deleteAllRecords('Factures');
                                    if (res.success) toast.success("Table Factures vidée !");
                                    else toast.error("Erreur suppression: " + res.error);
                                    refreshData();
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            Tout supprimer
                        </button>
                    </div>
                </div>

                {/* CLIENTS SECTION */}
                <div className="glass-card p-6 rounded-2xl space-y-6 border border-white/10">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Users className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Clients</h3>
                            <p className="text-xs text-muted-foreground">{clients.length} clients enregistrés</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRefClients}
                                className="hidden"
                                onChange={handleClientsUpload}
                            />
                            <button
                                onClick={() => fileInputRefClients.current?.click()}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
                            >
                                <Upload className="h-4 w-4" />
                                Importer CSV Clients
                            </button>
                        </div>

                        <button
                            onClick={async () => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUS les clients ?")) {
                                    const res = await deleteAllRecords('Clients');
                                    if (res.success) toast.success("Table Clients vidée !");
                                    else toast.error("Erreur suppression: " + res.error);
                                    refreshData();
                                }
                            }}

                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            Tout supprimer
                        </button>
                    </div>
                </div>

                {/* PRODUITS SECTION */}
                <div className="glass-card p-6 rounded-2xl space-y-6 border border-white/10">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <div className="p-2 rounded-lg bg-pink-500/10">
                            <Package className="h-5 w-5 text-pink-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Produits</h3>
                            <p className="text-xs text-muted-foreground">{products.length} produits enregistrés</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRefProduits}
                                className="hidden"
                                onChange={handleProduitsUpload}
                            />
                            <button
                                onClick={() => fileInputRefProduits.current?.click()}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
                            >
                                <Upload className="h-4 w-4" />
                                Importer CSV Produits
                            </button>
                        </div>

                        <button
                            onClick={async () => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUS les produits ?")) {
                                    const res = await deleteAllRecords('Produits');
                                    if (res.success) toast.success("Table Produits vidée !");
                                    else toast.error("Erreur suppression: " + res.error);
                                    refreshData();
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            Tout supprimer
                        </button>
                    </div>
                </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex gap-3 text-yellow-500/90 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>
                    L'import CSV attend un format spécifique (Numéro, Client, Date, etc.).
                    La suppression des données est définitive et ne peut pas être annulée.
                    Assurez-vous d'avoir une sauvegarde si nécessaire.
                </p>
            </div>
        </div >
    );
}
