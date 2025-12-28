"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Clock, AlertCircle, FileText, MoreHorizontal, Download, Send, Trash2, Eye, CheckCircle, Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { cn } from "@/lib/utils";
import { Facture, StatusFacture } from "@/types";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";
import { deleteRecord, updateInvoice, markInvoiceAsSent, createInvoice, markInvoiceAsDownloaded } from "@/app/actions";
import { createClientAction as createClient } from "@/app/actions-clients";
import { EmailComposer } from "@/components/features/EmailComposer";
import { useInvoiceEmail } from "@/hooks/use-invoice-email";
import { Minimize2, Maximize2, X } from "lucide-react";
import { SidePanel } from "@/components/ui/SidePanel";
import { CommunicationsPanel } from "@/components/features/CommunicationsPanel";


const getStatusColor = (status: StatusFacture) => {
    switch (status) {
        case "Payée": return "bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/20";
        case "Envoyée": return "bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/20";
        case "Retard": return "bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2] dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/20";
        case "Brouillon": return "bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/20";
        case "Annulée": return "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-white/10 dark:text-muted-foreground dark:border-white/10";
        default: return "bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] dark:bg-gray-500/20 dark:text-muted-foreground";
    }
};

const formatDateSafe = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "-";
        return format(date, "dd.MM.yy");
    } catch {
        return "-";
    }
};

export default function InvoicesPageWrapper() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
            <InvoicesPage />
        </Suspense>
    );
}

function InvoicesPage() {
    const { invoices, clients, societe, refreshData, logAction, confirm, removeInvoice, updateInvoiceInList } = useData();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFacture | "ALL">("ALL");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preview State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewInvoiceNum, setPreviewInvoiceNum] = useState("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Status Change Modal State
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Facture | null>(null);
    const [newStatus, setNewStatus] = useState<StatusFacture>("Brouillon");
    const [paymentDate, setPaymentDate] = useState("");

    // Compose Window State
    const [composeInvoice, setComposeInvoice] = useState<Facture | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const { sendEmail, isUndoVisible, cancelSend } = useInvoiceEmail();
    const [draftData, setDraftData] = useState<any>(null); // For restoring draft

    // History Panel State
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [historyInvoice, setHistoryInvoice] = useState<Facture | null>(null);

    const handleOpenEmail = (facture: Facture) => {
        setComposeInvoice(facture);
        setIsComposerOpen(true);
        setDraftData(null);
    };

    const handleDownload = (facture: Facture) => {
        const client = clients.find(c => c.id === facture.clientId);

        // Validation Date Column
        if (facture.config?.showDateColumn) {
            const missingDate = facture.items.some(item => !item.date);
            if (missingDate) {
                toast.error("La colonne Date est activée mais certaines lignes n’ont pas de date. Veuillez corriger le document avant de générer le PDF.");
                return;
            }
        }

        if (!societe) {
            toast.error("Informations de la société manquantes.");
            return;
        }

        if (client) {
            generateInvoicePDF(facture, societe, client, {});
            logAction('read', 'facture', `Facture ${facture.numero} téléchargée`, facture.id);

            if (facture.statut === "Brouillon") {
                const updatedInvoice = { ...facture, statut: "Téléchargée" as StatusFacture };
                // Optimistic
                updateInvoiceInList(updatedInvoice);

                markInvoiceAsDownloaded(facture.id).then((res) => {
                    if (res.success) {
                        logAction('update', 'facture', `Statut Facture ${facture.numero} changé pour Téléchargée (Download)`, facture.id);
                        refreshData();
                    }
                });
            }
        } else {
            toast.error("Client introuvable pour cette facture.");
        }
    };

    // Read status filter from URL on mount
    useEffect(() => {
        const statusParam = searchParams.get("status");
        if (statusParam && ["Brouillon", "Envoyée", "Payée", "Retard", "Annulée"].includes(statusParam)) {
            setStatusFilter(statusParam as StatusFacture);
        }
    }, [searchParams]);

    const handlePreview = (facture: Facture) => {
        try {
            const client = clients.find(c => c.id === facture.clientId);
            if (!client) {
                alert("Client introuvable pour cette facture.");
                return;
            }
            if (!societe) {
                alert("Informations de la société manquantes.");
                return;
            }


            // Validation Date Column
            if (facture.config?.showDateColumn) {
                const missingDate = facture.items.some(item => !item.date);
                if (missingDate) {
                    alert("La colonne Date est activée mais certaines lignes n’ont pas de date. Veuillez corriger le document avant de générer l'aperçu.");
                    return;
                }
            }

            const url = generateInvoicePDF(facture, societe, client, {
                returnBlob: true
            });
            if (url && typeof url === 'string') {
                setPreviewUrl(url);
                setPreviewInvoiceNum(facture.numero);
                setIsPreviewOpen(true);
            } else {
                alert("Erreur lors de la génération du PDF.");
            }
        } catch (error) {
            console.error("Erreur lors de l'aperçu:", error);
            alert("Erreur lors de la génération de l'aperçu. Vérifiez la console pour plus de détails.");
        }
    };

    const filteredInvoices = invoices.filter(facture => {
        const client = clients.find(c => c.id === facture.clientId);
        const searchLower = searchTerm.toLowerCase();

        const matchesSearch =
            facture.numero.toLowerCase().includes(searchLower) ||
            (client?.nom || "").toLowerCase().includes(searchLower) ||
            facture.totalTTC.toString().includes(searchLower) ||
            facture.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 }).includes(searchLower);

        const matchesStatus = statusFilter === "ALL" || facture.statut === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Group invoices by month
    const invoicesByMonth = filteredInvoices.reduce((groups, invoice) => {
        const date = new Date(invoice.dateEmission);
        const monthKey = isNaN(date.getTime()) ? "Dates Invalides" : format(date, "MMMM yyyy", { locale: fr });

        if (!groups[monthKey]) {
            groups[monthKey] = [];
        }
        groups[monthKey].push(invoice);
        return groups;
    }, {} as Record<string, typeof invoices>);

    const sortedMonthKeys = Object.keys(invoicesByMonth).sort((a, b) => {
        if (a === "Dates Invalides") return 1;
        if (b === "Dates Invalides") return -1;
        const dateA = new Date(invoicesByMonth[a][0].dateEmission);
        const dateB = new Date(invoicesByMonth[b][0].dateEmission);
        return dateB.getTime() - dateA.getTime();
    });

    const totalFilteredTTC = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalTTC, 0);

    const handleDelete = (id: string) => {
        confirm({
            title: "Supprimer la facture",
            message: "Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.",
            onConfirm: async () => {
                const invoiceToDelete = invoices.find(i => i.id === id);

                // Optimistic Update
                removeInvoice(id);
                toast.success("Facture mise à la corbeille");

                // Async Background
                try {
                    await deleteRecord('Factures', id);
                    dataService.deleteInvoice(id);
                    if (invoiceToDelete) {
                        const clientName = clients.find(c => c.id === invoiceToDelete.clientId)?.nom || "Client inconnu";
                        logAction('delete', 'facture', `A mis à la corbeille la facture ${invoiceToDelete.numero} pour ${clientName}`, id);
                    }
                    refreshData(); // Sync exact state eventually
                } catch (e) {
                    console.error(e);
                    toast.error("Erreur lors de la suppression (restauration recommandée)");
                    refreshData(); // Revert on error
                }
            }
        });
    };

    const handleStatusClick = (facture: Facture) => {
        setSelectedInvoice(facture);
        setNewStatus(facture.statut);
        setPaymentDate(facture.datePaiement || new Date().toISOString().split("T")[0]);
        setStatusModalOpen(true);
    };

    const handleStatusChange = async () => {
        if (!selectedInvoice) return;

        const updatedInvoice = {
            ...selectedInvoice,
            statut: newStatus,
            datePaiement: newStatus === "Payée" ? paymentDate : undefined
        };

        // Optimistic
        updateInvoiceInList(updatedInvoice);
        setStatusModalOpen(false); // Close immediately
        setSelectedInvoice(null);

        // Async Background
        try {
            await updateInvoice(updatedInvoice);
            dataService.saveInvoice(updatedInvoice);

            const clientName = clients.find(c => c.id === selectedInvoice.clientId)?.nom || "Client inconnu";
            logAction('update', 'facture', `Statut Facture ${selectedInvoice.numero} changé pour ${newStatus} (Client: ${clientName})`, selectedInvoice.id);

            refreshData(); // Sync Eventually
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la mise à jour du statut");
            refreshData(); // Revert
        }
    };

    const parseFrenchNumber = (str: string) => {
        if (!str) return 0;
        return parseFloat(str.replace(/\s/g, "").replace(",", ".")) || 0;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split("\n").filter(line => line.trim() !== "");
        const firstLine = lines[0] || "";
        const separator = firstLine.includes(";") ? ";" : ",";
        const dataRows = lines.slice(1);
        const updatedClients = [...clients];

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
            if (cleaned.startsWith('="') && cleaned.endsWith('"')) {
                cleaned = cleaned.slice(2, -1);
            }
            if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                cleaned = cleaned.slice(1, -1);
            }
            return cleaned.trim();
        };

        for (const rowStr of dataRows) {
            const row = parseCSVLine(rowStr, separator);
            if (row.length < 5) continue;

            const numero = cleanString(row[0]);
            const clientName = cleanString(row[1]);
            const dateEmission = cleanString(row[2]);
            const echeance = cleanString(row[3]);
            const datePaiement = cleanString(row[4]);

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
                }
                else if (cleaned.includes(",")) {
                    cleaned = cleaned.replace(",", ".");
                }
                return parseFloat(cleaned) || 0;
            };

            const totalHT = cleanAmount(row[6]);
            const totalTTC = cleanAmount(row[7]);
            const rawStatus = row[8]?.trim();

            if (!numero || !clientName) continue;

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
                // dataService.saveClient(newClient); // Deprecated
                await createClient(newClient); // Server Action
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

            // dataService.saveInvoice(newInvoice); // Deprecated
            await createInvoice(newInvoice); // Server Action
            importCount++;
        }

        if (importCount > 0) {
            refreshData();
            alert(`${importCount} factures importées avec succès !`);
        } else {
            alert("Aucune facture importée. Vérifiez le format du fichier.");
        }

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Factures</h2>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-muted-foreground">Suivi de la facturation.</p>
                        <div className="h-4 w-[1px] bg-border dark:bg-white/10"></div>
                        <p className="text-emerald-500 font-medium">
                            Total affiché : {totalFilteredTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href="/factures/new" className="flex items-center gap-2 rounded-lg bg-emerald-600 dark:bg-emerald-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20 backdrop-blur-sm">
                        <Plus className="h-4 w-4" />
                        Nouvelle Facture
                    </Link>
                </div>
            </div>

            <div className="glass-card rounded-xl p-4">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Rechercher par numéro ou client..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 w-full rounded-lg glass-input pl-10 pr-4 text-sm transition-all focus:ring-1 focus:ring-primary/20 text-foreground"
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFacture | "ALL")}
                            className="h-10 w-full rounded-lg px-4 pl-10 pr-4 text-sm appearance-none cursor-pointer text-foreground bg-transparent border border-border dark:border-white/20 hover:border-primary/30 focus:border-primary/50 focus:ring-0 transition-colors"
                        >
                            <option value="ALL" className="text-foreground bg-background">Tous les statuts</option>
                            <option value="Brouillon" className="text-foreground bg-background">Brouillon</option>
                            <option value="Envoyée" className="text-foreground bg-background">Envoyée</option>
                            <option value="Payée" className="text-foreground bg-background">Payée</option>
                            <option value="Retard" className="text-foreground bg-background">Retard</option>
                            <option value="Annulée" className="text-foreground bg-background">Annulée</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {sortedMonthKeys.map(month => {
                    const monthlyTotal = invoicesByMonth[month].reduce((sum, inv) => sum + inv.totalTTC, 0);
                    const sortedInvoices = [...invoicesByMonth[month]].sort((a, b) => {
                        // Priority: UpdatedAt -> CreatedAt -> DateEmission
                        const dateA = new Date(a.updatedAt || a.createdAt || a.dateEmission).getTime();
                        const dateB = new Date(b.updatedAt || b.createdAt || b.dateEmission).getTime();

                        // 1. Sort by Last Modification Descending
                        if (dateB !== dateA) {
                            return dateB - dateA;
                        }

                        // 2. Sort by Invoice Number Descending as fallback
                        return b.numero.localeCompare(a.numero, undefined, { numeric: true, sensitivity: 'base' });
                    });

                    return (
                        <div key={month}>
                            <div className="flex items-center justify-between mb-4 pl-1">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{month}</h3>
                                <span className="text-xs font-medium text-muted-foreground bg-muted/50 dark:bg-white/5 px-2 py-1 rounded-md">
                                    Total : {monthlyTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                </span>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block glass-card rounded-xl overflow-x-auto">
                                <table className="w-full text-left text-sm text-muted-foreground">
                                    <thead className="bg-primary/10 text-xs uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-4 font-medium">Numéro</th>
                                            <th className="px-3 py-4 font-medium">Client</th>
                                            <th className="px-3 py-4 font-medium">Créée le</th>
                                            <th className="px-3 py-4 font-medium">Échéance</th>
                                            <th className="px-3 py-4 font-medium">Payée le</th>
                                            <th className="px-3 py-4 font-medium">Montant TTC</th>
                                            <th className="px-3 py-4 font-medium">Statut</th>
                                            <th className="px-3 py-4 font-medium text-right w-[150px]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border dark:divide-white/5">
                                        {sortedInvoices.map((facture) => {
                                            const client = clients.find(c => c.id === facture.clientId);



                                            return (
                                                <tr
                                                    key={facture.id}
                                                    onClick={() => handlePreview(facture)}
                                                    className="hover:bg-muted/50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-3 py-4 font-medium text-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-4 w-4 text-purple-500" />
                                                            {facture.numero}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-4 max-w-[200px] truncate" title={client?.nom}>
                                                        {client?.nom || "Inconnu"}
                                                    </td>
                                                    <td className="px-3 py-4">{formatDateSafe(facture.dateEmission)}</td>
                                                    <td className="px-3 py-4">{formatDateSafe(facture.echeance)}</td>
                                                    <td className="px-3 py-4">{formatDateSafe(facture.datePaiement)}</td>
                                                    <td className="px-3 py-4 font-bold text-foreground">
                                                        {facture.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStatusClick(facture);
                                                            }}
                                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                                        >
                                                            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border", getStatusColor(facture.statut))}>
                                                                {facture.statut}
                                                            </span>
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-4 text-right relative z-10 whitespace-nowrap">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={(e) => { e.stopPropagation(); router.push(`/factures/${facture.id}`); }} className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-md transition-colors" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (facture.statut !== "Annulée") {
                                                                        handleOpenEmail(facture);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "p-1.5 rounded-md transition-colors",
                                                                    facture.statut === "Annulée"
                                                                        ? "text-muted-foreground/30 cursor-not-allowed"
                                                                        : "text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10"
                                                                )}
                                                                title={facture.statut === "Annulée" ? "Envoi désactivé" : "Envoyer par email"}
                                                            >
                                                                <Send className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); setHistoryInvoice(facture); setHistoryPanelOpen(true); }} className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors" title="Historique des envois"><Clock className="h-3.5 w-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDownload(facture); }} className="p-1.5 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 rounded-md transition-colors" title="Télécharger"><Download className="h-3.5 w-3.5" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(facture.id); }} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
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
                                {sortedInvoices.map((facture) => {
                                    const client = clients.find(c => c.id === facture.clientId);
                                    return (
                                        <div
                                            key={facture.id}
                                            onClick={() => handlePreview(facture)}
                                            className="glass-card p-4 rounded-xl active:scale-[0.98] transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <FileText className="h-4 w-4 text-purple-500" />
                                                        <span className="font-semibold text-foreground">{facture.numero}</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{client?.nom || "Client inconnu"}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStatusClick(facture);
                                                    }}
                                                >
                                                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border", getStatusColor(facture.statut))}>
                                                        {facture.statut}
                                                    </span>
                                                </button>
                                            </div>

                                            <div className="flex justify-between items-end">
                                                <div className="text-sm">
                                                    <p className="text-muted-foreground text-xs">Montant TTC</p>
                                                    <p className="font-bold text-lg text-foreground mt-0.5">
                                                        {facture.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); router.push(`/factures/${facture.id}`); }} className="p-2 bg-muted/50 dark:bg-white/5 rounded-lg text-muted-foreground hover:text-orange-400 active:bg-muted dark:active:bg-white/10" title="Modifier"><Pencil className="h-4 w-4" /></button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (facture.statut !== "Annulée") {
                                                                handleOpenEmail(facture);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "p-2 rounded-lg transition-colors",
                                                            facture.statut === "Annulée"
                                                                ? "bg-muted/50 dark:bg-white/5 text-muted-foreground/30 cursor-not-allowed"
                                                                : "bg-muted/50 dark:bg-white/5 text-muted-foreground hover:text-indigo-400 active:bg-muted dark:active:bg-white/10"
                                                        )}
                                                        title={facture.statut === "Annulée" ? "Envoi désactivé" : "Envoyer"}
                                                    >
                                                        <Send className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setHistoryInvoice(facture); setHistoryPanelOpen(true); }} className="p-2 bg-muted/50 dark:bg-white/5 rounded-lg text-muted-foreground hover:text-blue-400 active:bg-muted dark:active:bg-white/10" title="Historique"><Clock className="h-4 w-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(facture); }} className="p-2 bg-muted/50 dark:bg-white/5 rounded-lg text-muted-foreground hover:text-emerald-400 active:bg-muted dark:active:bg-white/10" title="PDF"><Download className="h-4 w-4" /></button>
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {sortedMonthKeys.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        Aucune facture trouvée.
                    </div>
                )}
            </div>
            <PDFPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                pdfUrl={previewUrl}
                invoiceNumber={previewInvoiceNum}
            />

            {
                statusModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="glass-card rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
                            <h3 className="text-xl font-bold text-foreground">Modifier le statut</h3>
                            <p className="text-sm text-muted-foreground">
                                Facture: {selectedInvoice?.numero}
                            </p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">
                                        Nouveau statut
                                    </label>
                                    <select
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value as StatusFacture)}
                                        className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                    >
                                        {(selectedInvoice?.statut === "Brouillon" ? ["Brouillon"] : []).concat(["Payée", "Retard", "Annulée"]).map((status) => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>

                                {newStatus === "Payée" && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-muted-foreground">
                                            Date de paiement *
                                        </label>
                                        <input
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                            required
                                        />
                                    </div>
                                )}
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
            {/* Gmail-style Compose Window */}
            {isComposerOpen && composeInvoice && (
                <div className="fixed bottom-0 right-10 w-[600px] h-[600px] bg-background dark:bg-[#1e1e1e] border border-border dark:border-white/10 rounded-t-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 dark:bg-[#1e1e1e] border-b border-border dark:border-white/10 cursor-pointer" onClick={() => setIsComposerOpen(false)}>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">Nouveau message - {composeInvoice.numero}</span>
                            <button
                                className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1 transition-colors border border-blue-500/20"
                                title="Voir l'historique"
                                onClick={(e) => { e.stopPropagation(); setHistoryInvoice(composeInvoice); setHistoryPanelOpen(true); }}
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
                            key={draftData ? 'draft-restore' : composeInvoice.id}
                            defaultTo={draftData ? draftData.to : (clients.find(c => c.id === composeInvoice.clientId)?.email || "")}
                            defaultSubject={draftData ? draftData.subject : `Facture ${composeInvoice.numero} - ${societe?.nom}`}
                            defaultMessage={draftData ? draftData.message : `Madame, Monsieur,\n\nVeuillez trouver ci-joint votre facture n°${composeInvoice.numero}.\n\nCordialement,\n${societe?.nom || ""}`}
                            mainAttachmentName={`Facture_${composeInvoice.numero}.pdf`}
                            onSend={async (data) => {
                                setIsComposerOpen(false);
                                await sendEmail(composeInvoice, data, {
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
                                // Find invoice if we lost it?
                                // We rely on 'composeInvoice' still being set? No, we might have closed.
                                // But usually user stays on same page.
                                // If composeInvoice is null, we can't open easily unless we find it.
                                // Restored draft has invoiceId.
                                const inv = invoices.find(i => i.id === restored.invoiceId);
                                if (inv) {
                                    setComposeInvoice(inv);
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
                title={historyInvoice ? `Historique - ${historyInvoice.numero}` : "Historique"}
            >
                {historyInvoice && (
                    <div key={historyInvoice.id}>
                        <CommunicationsPanel
                            invoice={historyInvoice}
                            defaultComposeOpen={false}
                            hideComposeButton={true}
                        />
                    </div>
                )}
            </SidePanel>
        </div>
    );
}
