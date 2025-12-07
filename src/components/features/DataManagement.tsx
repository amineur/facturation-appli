"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, FileText, Receipt, Database, AlertTriangle, Users, Package } from "lucide-react";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { StatusDevis, StatusFacture, Devis, Facture, Client, Produit } from "@/types";
import { cn } from "@/lib/utils";

export function DataManagement({ onBack }: { onBack?: () => void }) {
    const { clients, refreshData, societe, invoices, quotes, products } = useData();
    const fileInputRefDevis = useRef<HTMLInputElement>(null);
    const fileInputRefFactures = useRef<HTMLInputElement>(null);
    const fileInputRefClients = useRef<HTMLInputElement>(null);
    const fileInputRefProduits = useRef<HTMLInputElement>(null);

    // --- SHARED UTILS --- 
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

        dataRows.forEach(rowStr => {
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
            importCount++;
        });

        refreshData();
        alert(`${importCount} devis importés avec succès !`);
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

        dataRows.forEach(rowStr => {
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
            importCount++;
        });

        refreshData();
        alert(`${importCount} factures importées avec succès !`);
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

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(",").map(c => c.trim());
            let clientData: Partial<Client> = {};

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
                count++;
            }
        }

        refreshData();
        alert(`${count} clients importés avec succès !`);
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

        dataRows.forEach(rowStr => {
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
            importCount++;
        });

        refreshData();
        alert(`${importCount} produit(s) importé(s) avec succès !`);
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
                            onClick={() => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUS les devis ?")) {
                                    quotes.forEach(q => dataService.deleteQuote(q.id));
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
                            onClick={() => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUTES les factures ?")) {
                                    dataService.deleteAllInvoices();
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
                            onClick={() => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUS les clients ?")) {
                                    clients.forEach(c => dataService.deleteClient(c.id));
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
                            onClick={() => {
                                if (confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer TOUS les produits ?")) {
                                    products.forEach(p => dataService.deleteProduct(p.id));
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
        </div>
    );
}
