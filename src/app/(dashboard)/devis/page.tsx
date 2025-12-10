"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { Plus, Search, FileText, Calendar, ArrowRight, CheckCircle, Trash2, Upload, Filter, Eye, Pencil, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDevis, Devis } from "@/types";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { useRouter } from "next/navigation";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";
import { format } from "date-fns";
import { deleteRecord, updateQuoteStatus, convertQuoteToInvoice } from "@/app/actions";
import { toast } from "sonner";

const getStatusColor = (status: StatusDevis) => {
    switch (status) {
        case "Accepté":
        case "Facturé": return "bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/20";
        case "Envoyé": return "bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/20";
        case "Refusé": return "bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2] dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/20";
        case "Brouillon": return "bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/20";
        default: return "bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] dark:bg-gray-500/20 dark:text-gray-300";
    }
};

export default function DevisPageWrapper() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
            <DevisPage />
        </Suspense>
    );
}

function DevisPage() {
    const { quotes, clients, refreshData, societe, confirm, logAction } = useData();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusDevis | "ALL">("ALL");
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preview State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewInvoiceNum, setPreviewInvoiceNum] = useState("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const handlePreview = (devis: Devis) => {
        const client = clients.find(c => c.id === devis.clientId);
        if (client && societe) {
            const url = generateInvoicePDF(devis, societe, client, { returnBlob: true });
            if (url && typeof url === 'string') {
                setPreviewUrl(url);
                setPreviewInvoiceNum(devis.numero);
                setIsPreviewOpen(true);
            }
        }
    };

    const handleDownload = (devis: Devis) => {
        if (!societe) {
            toast.error("Informations de la société manquantes");
            return;
        }
        const client = clients.find(c => c.id === devis.clientId);
        if (client) {
            generateInvoicePDF(devis, societe, client, {});
            logAction('read', 'devis', `Devis ${devis.numero} téléchargé pour ${client.nom}`, devis.id);
        } else {
            toast.error("Client introuvable");
        }
    };

    const filteredDevis = quotes.filter(devis => {
        const client = clients.find(c => c.id === devis.clientId);
        const searchLower = searchTerm.toLowerCase();

        const matchesSearch =
            devis.numero.toLowerCase().includes(searchLower) ||
            (client?.nom || "").toLowerCase().includes(searchLower) ||
            devis.totalTTC.toString().includes(searchLower) ||
            devis.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 }).includes(searchLower);

        const matchesStatus = statusFilter === "ALL" || devis.statut === statusFilter;
        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        const dateDiff = new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime();
        if (dateDiff !== 0) return dateDiff;
        // Secondary sort by number descending (higher number = newer)
        return b.numero.localeCompare(a.numero, undefined, { numeric: true });
    });

    const handleMarkAsBilled = async (devis: Devis) => {
        // Automatically convert to Invoice (Create Invoice + Set Status Facturé)
        const res = await convertQuoteToInvoice(devis.id);

        if (res.success && res.newInvoiceId) {
            const client = clients.find(c => c.id === devis.clientId);
            const clientName = client ? client.nom : "Client inconnu";
            const invoiceRef = res.newInvoiceNumber || "???";
            logAction('create', 'facture', `Devis ${devis.numero} converti en facture ${invoiceRef} pour ${clientName}`, res.newInvoiceId);
            refreshData();
            toast.success("Devis validé et Facture créée avec succès !");
        } else {
            toast.error("Erreur lors de la création de la facture : " + (res.error || "Inconnue"));
        }
    };

    const handleDelete = (id: string) => {
        confirm({
            title: "Supprimer le devis",
            message: "Êtes-vous sûr de vouloir supprimer ce devis ?",
            onConfirm: async () => {
                const devisToDelete = quotes.find(q => q.id === id);
                await deleteRecord('Devis', id);
                dataService.deleteQuote(id);
                if (devisToDelete) {
                    const clientName = clients.find(c => c.id === devisToDelete.clientId)?.nom || "Client inconnu";
                    logAction('delete', 'devis', `Devis ${devisToDelete.numero} supprimé pour ${clientName}`, id);
                }
                refreshData();
                toast.success("Devis supprimé");
            }
        });
    };




    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split("\n").filter(line => line.trim() !== "");

        const firstLine = lines[0] || "";
        const separator = firstLine.includes(";") ? ";" : ",";
        const dataRows = lines.slice(1); // Skip header

        let importCount = 0;

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

        dataRows.forEach(rowStr => {
            const row = parseCSVLine(rowStr, separator);
            // Cols: 0:Num, 1:Client, 2:Créé, 3:Validité, 4:RefPaiement, 5:HT, 6:TTC, 7:Statut

            if (row.length < 5) return;

            const numero = cleanString(row[0]);
            const clientName = cleanString(row[1]);
            const dateEmission = cleanString(row[2]);
            const dateValidite = cleanString(row[3]);
            // const refPaiement = cleanString(row[4]); // Ignored for now
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

        if (importCount > 0) {
            refreshData();
            toast.success(`${importCount} devis importés avec succès !`);
        } else {
            toast.info("Aucun devis importé. Vérifiez le format.");
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Group quotes by month
    const quotesByMonth = filteredDevis.reduce((groups, quote) => {
        const date = new Date(quote.dateEmission);
        const monthKey = isNaN(date.getTime()) ? "Dates Invalides" : new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);

        // Capitalize first letter
        const formattedKey = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);

        if (!groups[formattedKey]) {
            groups[formattedKey] = [];
        }
        groups[formattedKey].push(quote);
        return groups;
    }, {} as Record<string, typeof quotes>);

    const sortedMonthKeys = Object.keys(quotesByMonth).sort((a, b) => {
        if (a === "Dates Invalides") return 1;
        if (b === "Dates Invalides") return -1;
        const dateA = new Date(quotesByMonth[a][0].dateEmission);
        const dateB = new Date(quotesByMonth[b][0].dateEmission);
        return dateB.getTime() - dateA.getTime(); // Reverted to Descending (Newest First)
    });

    const totalFilteredTTC = filteredDevis.reduce((sum, item) => sum + item.totalTTC, 0);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Devis</h2>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-muted-foreground">Gérez vos propositions commerciales.</p>
                        <div className="h-4 w-[1px] bg-white/10"></div>
                        <p className="text-emerald-500 font-medium">
                            Total affiché : {totalFilteredTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href="/devis/new" className="flex items-center gap-2 rounded-lg bg-orange-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 transition-colors shadow-lg shadow-orange-500/20 backdrop-blur-sm">
                        <Plus className="h-4 w-4" />
                        Nouveau Devis
                    </Link>
                </div>
            </div>



            <div className="glass-card rounded-xl p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Rechercher par numéro..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-lg glass-input pl-10 pr-4 text-sm transition-all focus:ring-1 focus:ring-white/20 text-foreground"
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusDevis | "ALL")}
                            className="h-10 w-full rounded-lg px-4 pl-10 pr-4 text-sm appearance-none cursor-pointer text-foreground bg-transparent border border-white/20 hover:border-white/30 focus:border-white/40 focus:ring-0 transition-colors"
                        >
                            <option value="ALL" className="text-foreground bg-background">Tous les statuts</option>
                            <option value="Brouillon" className="text-foreground bg-background">Brouillon</option>
                            <option value="Envoyé" className="text-foreground bg-background">Envoyé</option>
                            <option value="Accepté" className="text-foreground bg-background">Accepté</option>
                            <option value="Refusé" className="text-foreground bg-background">Refusé</option>
                            <option value="Facturé" className="text-foreground bg-background">Facturé</option>
                        </select>
                    </div>
                </div>
            </div>

            {sortedMonthKeys.map(month => {
                const monthTotal = quotesByMonth[month].reduce((sum, q) => sum + q.totalTTC, 0);

                return (
                    <div key={month}>
                        <div className="flex items-center justify-between mb-4 pl-1">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{month}</h3>
                            <span className="text-xs font-medium text-muted-foreground bg-white/5 px-2 py-1 rounded-md">
                                Total : {monthTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            </span>
                        </div>
                        {/* Desktop Table */}
                        <div className="hidden md:block glass-card rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm text-muted-foreground">
                                <thead className="bg-primary/10 text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Numéro</th>
                                        <th className="px-6 py-4 font-medium">Client</th>
                                        <th className="px-6 py-4 font-medium">Créé le</th>
                                        <th className="px-6 py-4 font-medium">Montant TTC</th>
                                        <th className="px-6 py-4 font-medium">Statut</th>
                                        <th className="px-6 py-4 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {quotesByMonth[month].map((devis) => {
                                        const client = clients.find(c => c.id === devis.clientId);
                                        return (
                                            <tr key={devis.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handlePreview(devis)}>
                                                <td className="px-6 py-4 font-medium text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-purple-500" />
                                                        {devis.numero}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {client?.nom || "Inconnu"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {devis.dateEmission ? format(new Date(devis.dateEmission), "dd.MM.yy") : "-"}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-foreground">
                                                    {devis.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={cn(
                                                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                                                        getStatusColor(devis.statut)
                                                    )}>
                                                        {devis.statut}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right relative z-10">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); router.push(`/devis/${devis.id}`); }} className="p-2 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-md transition-colors" title="Modifier"><Pencil className="h-4 w-4" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDownload(devis); }} className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors" title="Télécharger PDF"><Download className="h-4 w-4" /></button>
                                                        {devis.statut !== "Facturé" && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleMarkAsBilled(devis); }} className="p-2 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-md transition-colors" title="Marquer comme Facturé"><CheckCircle className="h-4 w-4" /></button>
                                                        )}
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(devis.id); }} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Mettre à la corbeille"><Trash2 className="h-4 w-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3">
                            {quotesByMonth[month].map((devis) => {
                                const client = clients.find(c => c.id === devis.clientId);
                                return (
                                    <div
                                        key={devis.id}
                                        onClick={() => handlePreview(devis)}
                                        className="glass-card p-4 rounded-xl active:scale-[0.98] transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileText className="h-4 w-4 text-purple-500" />
                                                    <span className="font-semibold text-foreground">{devis.numero}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{client?.nom || "Client inconnu"}</p>
                                            </div>
                                            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border", getStatusColor(devis.statut))}>
                                                {devis.statut}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div className="text-sm">
                                                <p className="text-muted-foreground text-xs">Montant TTC</p>
                                                <p className="font-bold text-lg text-foreground mt-0.5">
                                                    {devis.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); router.push(`/devis/${devis.id}`); }} className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-orange-400 active:bg-white/10"><Pencil className="h-4 w-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(devis); }} className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-emerald-400 active:bg-white/10"><Download className="h-4 w-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            <PDFPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                pdfUrl={previewUrl}
                invoiceNumber={previewInvoiceNum}
            />
        </div>
    );
}
