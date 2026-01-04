"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { Plus, Search, FileText, Calendar, ArrowRight, CheckCircle, Trash2, Upload, Filter, Eye, Pencil, Download, Send, Clock, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDevis, Devis, Facture } from "@/types";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { useRouter } from "next/navigation";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";
import { format } from "date-fns";
import { safeFormat } from "@/lib/date-utils";
import { deleteRecord, updateQuoteStatus, convertQuoteToInvoice } from "@/app/actions";
import { toast } from "sonner";
import { useInvoiceEmail } from "@/hooks/use-invoice-email";
import { EmailComposer } from "@/components/features/EmailComposer";
import { SidePanel } from "@/components/ui/SidePanel";
import { CommunicationsPanel } from "@/components/features/CommunicationsPanel";
import { getClientDisplayName, getClientSearchText } from "@/lib/client-utils";


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

    // Status Change Modal State
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Devis | null>(null);
    const [newStatus, setNewStatus] = useState<StatusDevis>("Brouillon");

    // Preview State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewInvoiceNum, setPreviewInvoiceNum] = useState("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Email State
    const { sendEmail, isUndoVisible, cancelSend } = useInvoiceEmail();
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composeQuote, setComposeQuote] = useState<Devis | null>(null);
    const [draftData, setDraftData] = useState<any>(null);

    // History Panel State
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [historyQuote, setHistoryQuote] = useState<Devis | null>(null);

    const handleOpenEmail = (devis: Devis) => {
        setComposeQuote(devis);
        setIsComposerOpen(true);
        setDraftData(null);
    };




    // Existing handlers...
    const handlePreview = (devis: Devis) => {
        // Validation Date Column
        if (devis.config?.showDateColumn) {
            const missingDate = devis.items.some(item => !item.date);
            if (missingDate) {
                toast.error("La colonne Date est activée mais certaines lignes n’ont pas de date. Veuillez corriger le document avant de générer le PDF.");
                return;
            }
        }

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

    const handleDownload = async (devis: Devis) => {
        // Validation Date Column
        if (devis.config?.showDateColumn) {
            const missingDate = devis.items.some(item => !item.date);
            if (missingDate) {
                toast.error("La colonne Date est activée mais certaines lignes n’ont pas de date. Veuillez corriger le document avant de générer le PDF.");
                return;
            }
        }

        if (!societe) {
            toast.error("Informations de la société manquantes");
            return;
        }
        const client = clients.find(c => c.id === devis.clientId);
        if (client) {
            // Callback via Promise not needed for synchronous jsPDF save, but good for sequential flow
            generateInvoicePDF(devis, societe, client, {});

            // Fix: Update Status to Téléchargé if Brouillon
            if (devis.statut === "Brouillon") {
                try {
                    await updateQuoteStatus(devis.id, "Téléchargé");
                    // We can also reuse markInvoiceAsDownloaded logic if we had a markQuoteAsDownloaded, but updateQuoteStatus is sufficient here based on previous work.
                    logAction('update', 'devis', `Devis ${devis.numero} téléchargé (Statut mis à jour)`, devis.id);
                    refreshData();
                } catch (error) {
                    console.error("Failed to update status on download", error);
                }
            } else {
                logAction('read', 'devis', `Devis ${devis.numero} téléchargé pour ${getClientDisplayName(client)}`, devis.id);
            }
        } else {
            toast.error("Client introuvable");
        }
    };

    const handleStatusClick = (devis: Devis) => {
        setSelectedQuote(devis);
        setNewStatus(devis.statut);
        setStatusModalOpen(true);
    };

    const handleStatusChange = async () => {
        if (!selectedQuote) return;

        // Use updateQuoteStatus for simpler partial update or updateQuote for full consistency
        // Using updateQuote to ensure consistency with data model if needed, but updateQuoteStatus is lighter
        // Let's use updateQuoteStatus if imported, or updateQuote if existing pattern favors it.
        // Invoice page uses updateInvoice.
        // Let's use updateQuoteStatus since it exists and is specific.
        // Wait, updateQuoteStatus is imported on line 14.
        const res = await updateQuoteStatus(selectedQuote.id, newStatus);

        if (res.success) {
            const client = clients.find(c => c.id === selectedQuote.clientId);
            const clientName = client ? getClientDisplayName(client) : "Client inconnu";
            logAction('update', 'devis', `Statut Devis ${selectedQuote.numero} changé pour ${newStatus} (Client: ${clientName})`, selectedQuote.id);
            refreshData();
            toast.success(`Statut modifié : ${newStatus}`);
        } else {
            toast.error("Erreur lors de la mise à jour du statut");
        }

        setStatusModalOpen(false);
        setSelectedQuote(null);
    };

    // Filter logic...
    const filteredDevis = quotes.filter(devis => {
        const client = clients.find(c => c.id === devis.clientId);
        const searchLower = searchTerm.toLowerCase();

        const matchesSearch =
            devis.numero.toLowerCase().includes(searchLower) ||
            (client ? getClientSearchText(client).includes(searchLower) : false) ||
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
            const clientName = client ? getClientDisplayName(client) : "Client inconnu";
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
                    const client = clients.find(c => c.id === devisToDelete.clientId);
                    const clientName = client ? getClientDisplayName(client) : "Client inconnu";
                    logAction('delete', 'devis', `Devis ${devisToDelete.numero} supprimé pour ${clientName}`, id);
                }
                refreshData();
                toast.success("Devis supprimé");
            }
        });
    };

    // ... (rest of imports/helpers same until JSX)

    // Helper for table row status badge
    // We will inline the button logic in the JSX return

    // ... (existing helper functions like handleFileUpload, quotesByMonth etc.)

    // RENDER
    // Just returning the modified JSX structure where status is present
    // Since this is a partial replace, I need to match the structure efficiently.
    // Actually, I'll need to use multi_replace for specific spots: 
    // 1. State definition (top of component)
    // 2. Desktop Table Status Cell (middle)
    // 3. Mobile Card Status Cell (middle)
    // 4. Modal definition (bottom)






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
                        <div className="h-4 w-[1px] bg-border dark:bg-white/10"></div>
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
                            className="h-10 w-full rounded-lg pl-10 pr-4 text-sm transition-all focus:ring-1 focus:ring-primary/20 text-foreground bg-transparent border border-border dark:border-white/20 hover:border-primary/30 focus:border-primary/50"
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusDevis | "ALL")}
                            className="h-10 w-full rounded-lg px-4 pr-4 text-sm appearance-none cursor-pointer text-foreground bg-transparent border border-border dark:border-white/20 hover:border-primary/30 focus:border-primary/50 focus:ring-0 transition-colors"
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
                            <span className="text-xs font-medium text-muted-foreground bg-muted/50 dark:bg-white/5 px-2 py-1 rounded-md">
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
                                        <th className="px-6 py-4 font-medium text-right w-[150px]">Action</th>

                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border dark:divide-white/5">
                                    {quotesByMonth[month].map((devis) => {
                                        const client = clients.find(c => c.id === devis.clientId);
                                        return (
                                            <tr key={devis.id} className="hover:bg-muted/50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handlePreview(devis)}>
                                                <td className="px-6 py-4 font-medium text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-purple-500" />
                                                        {devis.numero}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {client ? getClientDisplayName(client) : "Inconnu"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {safeFormat(devis.dateEmission, "dd.MM.yy")}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-foreground">
                                                    {devis.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (devis.statut !== "Facturé" && devis.statut !== "Archivé") {
                                                                handleStatusClick(devis);
                                                            }
                                                        }}
                                                        disabled={devis.statut === "Facturé" || devis.statut === "Archivé"}
                                                        className={cn(
                                                            "transition-opacity",
                                                            (devis.statut === "Facturé" || devis.statut === "Archivé")
                                                                ? "cursor-default opacity-100"
                                                                : "cursor-pointer hover:opacity-80"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                                                            getStatusColor(devis.statut)
                                                        )}>
                                                            {devis.statut}
                                                        </span>
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-right relative z-10">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); router.push(`/devis/${devis.id}`); }} className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-md transition-colors" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>

                                                        <button onClick={(e) => { e.stopPropagation(); handleOpenEmail(devis); }} className="p-1.5 text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 rounded-md transition-colors" title="Envoyer par email"><Send className="h-3.5 w-3.5" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setHistoryQuote(devis); setHistoryPanelOpen(true); }} className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors" title="Historique des envois"><Clock className="h-3.5 w-3.5" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDownload(devis); }} className="p-1.5 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 rounded-md transition-colors" title="Télécharger PDF"><Download className="h-3.5 w-3.5" /></button>

                                                        {devis.statut !== "Facturé" && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleMarkAsBilled(devis); }} className="p-1.5 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-md transition-colors" title="Marquer comme Facturé"><CheckCircle className="h-3.5 w-3.5" /></button>
                                                        )}

                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(devis.id); }} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>

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
                                                <p className="text-sm text-muted-foreground">{client ? getClientDisplayName(client) : "Client inconnu"}</p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (devis.statut !== "Facturé" && devis.statut !== "Archivé") {
                                                        handleStatusClick(devis);
                                                    }
                                                }}
                                                disabled={devis.statut === "Facturé" || devis.statut === "Archivé"}
                                            >
                                                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border", getStatusColor(devis.statut))}>
                                                    {devis.statut}
                                                </span>
                                            </button>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div className="text-sm">
                                                <p className="text-muted-foreground text-xs">Montant TTC</p>
                                                <p className="font-bold text-lg text-foreground mt-0.5">
                                                    {devis.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); router.push(`/devis/${devis.id}`); }} className="p-2 bg-muted/50 dark:bg-white/5 rounded-lg text-muted-foreground hover:text-orange-400 active:bg-muted dark:active:bg-white/10" title="Modifier"><Pencil className="h-4 w-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenEmail(devis); }} className="p-2 bg-muted/50 dark:bg-white/5 rounded-lg text-muted-foreground hover:text-indigo-400 active:bg-muted dark:active:bg-white/10" title="Envoyer"><Send className="h-4 w-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); setHistoryQuote(devis); setHistoryPanelOpen(true); }} className="p-2 bg-muted/50 dark:bg-white/5 rounded-lg text-muted-foreground hover:text-blue-400 active:bg-muted dark:active:bg-white/10" title="Historique"><Clock className="h-4 w-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(devis); }} className="p-2 bg-muted/50 dark:bg-white/5 rounded-lg text-muted-foreground hover:text-emerald-400 active:bg-muted dark:active:bg-white/10" title="PDF"><Download className="h-4 w-4" /></button>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            {
                statusModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="glass-card rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
                            <h3 className="text-xl font-bold text-foreground">Modifier le statut</h3>
                            <p className="text-sm text-muted-foreground">
                                Devis: {selectedQuote?.numero}
                            </p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">
                                        Nouveau statut
                                    </label>
                                    <select
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value as StatusDevis)}
                                        className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                    >
                                        {(selectedQuote?.statut === "Brouillon" ? ["Brouillon"] : []).concat(["Envoyé", "Accepté", "Refusé"]).map((status) => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-4">
                                <button
                                    onClick={() => setStatusModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted dark:hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleStatusChange}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                                >
                                    Confirmer
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            <PDFPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                pdfUrl={previewUrl}
                invoiceNumber={previewInvoiceNum}
            />

            {/* Compose Window */}
            {isComposerOpen && composeQuote && (
                <div className="fixed bottom-0 right-10 w-[600px] h-[600px] bg-background dark:bg-[#1e1e1e] border border-border dark:border-white/10 rounded-t-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 dark:bg-[#1e1e1e] border-b border-border dark:border-white/10 cursor-pointer" onClick={() => setIsComposerOpen(false)}>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">Nouveau message - {composeQuote.numero}</span>
                            <button
                                className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1 transition-colors border border-blue-500/20"
                                title="Voir l'historique"
                                onClick={(e) => { e.stopPropagation(); setHistoryQuote(composeQuote); setHistoryPanelOpen(true); }}
                            >
                                <Clock className="h-3 w-3" />
                                Historique
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <button className="p-1 hover:bg-muted dark:hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}><Minimize2 className="h-4 w-4" /></button>
                            <button className="p-1 hover:bg-muted dark:hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}><X className="h-4 w-4" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden bg-background dark:bg-[#1e1e1e]">
                        <EmailComposer
                            key={draftData ? 'draft-restore' : composeQuote.id}
                            defaultTo={draftData ? draftData.to : (clients.find(c => c.id === composeQuote.clientId)?.email || "")}
                            defaultSubject={draftData ? draftData.subject : `Devis ${composeQuote.numero} - ${societe?.nom}`}
                            defaultMessage={draftData ? draftData.message : `Madame, Monsieur,\n\nVeuillez trouver ci-joint votre devis n°${composeQuote.numero}.\n\nCordialement,\n${societe?.nom || ""}`}
                            mainAttachmentName={`Devis_${composeQuote.numero}.pdf`}
                            onSend={async (data) => {
                                setIsComposerOpen(false);
                                await sendEmail(composeQuote, data, {
                                    onSuccess: () => {
                                        refreshData();
                                    }
                                });
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Undo Notification */}
            {isUndoVisible && (
                <div className="fixed bottom-6 right-6 bg-background border border-border text-foreground dark:bg-[#1e1e1e] dark:border-zinc-800 dark:text-white px-6 py-4 rounded-lg shadow-2xl z-[60] flex items-center gap-6 animate-in slide-in-from-bottom-5 duration-300 min-w-[320px]">
                    <div className="flex flex-col">
                        <span className="font-medium">Message envoyé</span>
                        <span className="text-xs text-muted-foreground">Envoi en cours...</span>
                    </div>
                    <button
                        onClick={() => {
                            const restored = cancelSend();
                            if (restored && restored.invoiceId) {
                                const q = quotes.find(i => i.id === restored.invoiceId);
                                if (q) {
                                    setComposeQuote(q);
                                    setDraftData(restored);
                                    setIsComposerOpen(true);
                                }
                            }
                        }}
                        className="ml-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded transition-colors"
                    >
                        Annuler
                    </button>
                </div>
            )}

            {/* History Side Panel */}
            <SidePanel
                isOpen={historyPanelOpen}
                onClose={() => setHistoryPanelOpen(false)}
                title={historyQuote ? `Historique - ${historyQuote.numero}` : "Historique"}
            >
                {historyQuote && (
                    <div key={historyQuote.id}>
                        <CommunicationsPanel
                            invoice={historyQuote as any}
                            defaultComposeOpen={false}
                            hideComposeButton={true}
                        />
                    </div>
                )}
            </SidePanel>

        </div>
    );
}
