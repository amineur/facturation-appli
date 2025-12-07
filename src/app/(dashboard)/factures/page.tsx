"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, FileText, Calendar, ArrowRight, Trash2, Upload, Filter, Pencil, Download, Send, Eye } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { cn } from "@/lib/utils";
import { Facture, StatusFacture } from "@/types";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";


const getStatusColor = (status: StatusFacture) => {
    switch (status) {
        case "Payée": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/20";
        case "Envoyée": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/20";
        case "Retard": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/20";
        case "Brouillon": return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/20";
        case "Annulée": return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/10 dark:text-muted-foreground dark:border-white/10";
        default: return "bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-muted-foreground";
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

export default function InvoicesPage() {
    const { invoices, clients, refreshData, societe } = useData();
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

            const url = generateInvoicePDF(facture, societe, client, {
                returnBlob: true,
                config: facture.config
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
        if (confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) {
            dataService.deleteInvoice(id);
            refreshData();
        }
    };

    const handleStatusClick = (facture: Facture) => {
        setSelectedInvoice(facture);
        setNewStatus(facture.statut);
        setPaymentDate(facture.datePaiement || new Date().toISOString().split("T")[0]);
        setStatusModalOpen(true);
    };

    const handleStatusChange = () => {
        if (!selectedInvoice) return;

        const updatedInvoice = {
            ...selectedInvoice,
            statut: newStatus,
            datePaiement: newStatus === "Payée" ? paymentDate : selectedInvoice.datePaiement
        };

        dataService.saveInvoice(updatedInvoice);
        refreshData();
        setStatusModalOpen(false);
        setSelectedInvoice(null);
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

        dataRows.forEach(rowStr => {
            const row = parseCSVLine(rowStr, separator);
            if (row.length < 5) return;

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
                        <div className="h-4 w-[1px] bg-white/10"></div>
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
                            className="h-10 w-full rounded-lg glass-input pl-10 pr-4 text-sm transition-all focus:ring-1 focus:ring-white/20 text-foreground"
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFacture | "ALL")}
                            className="h-10 w-full rounded-lg px-4 pl-10 pr-4 text-sm appearance-none cursor-pointer text-foreground bg-transparent border border-white/20 hover:border-white/30 focus:border-white/40 focus:ring-0 transition-colors"
                        >
                            <option value="ALL" className="bg-[#1a1a1a] text-foreground">Tous les statuts</option>
                            <option value="Brouillon" className="bg-[#1a1a1a] text-foreground">Brouillon</option>
                            <option value="Envoyée" className="bg-[#1a1a1a] text-foreground">Envoyée</option>
                            <option value="Payée" className="bg-[#1a1a1a] text-foreground">Payée</option>
                            <option value="Retard" className="bg-[#1a1a1a] text-foreground">Retard</option>
                            <option value="Annulée" className="bg-[#1a1a1a] text-foreground">Annulée</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {sortedMonthKeys.map(month => {
                    const monthlyTotal = invoicesByMonth[month].reduce((sum, inv) => sum + inv.totalTTC, 0);
                    const sortedInvoices = [...invoicesByMonth[month]].sort((a, b) =>
                        new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime()
                    );

                    return (
                        <div key={month}>
                            <div className="flex items-center justify-between mb-4 pl-1">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{month}</h3>
                                <span className="text-xs font-medium text-muted-foreground bg-white/5 px-2 py-1 rounded-md">
                                    Total : {monthlyTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                </span>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block glass-card rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm text-muted-foreground">
                                    <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Numéro</th>
                                            <th className="px-6 py-4 font-medium">Client</th>
                                            <th className="px-6 py-4 font-medium">Créée le</th>
                                            <th className="px-6 py-4 font-medium">Échéance</th>
                                            <th className="px-6 py-4 font-medium">Payée le</th>
                                            <th className="px-6 py-4 font-medium">Montant TTC</th>
                                            <th className="px-6 py-4 font-medium">Statut</th>
                                            <th className="px-6 py-4 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {sortedInvoices.map((facture) => {
                                            const client = clients.find(c => c.id === facture.clientId);

                                            const handleDownload = () => {
                                                if (client) {
                                                    generateInvoicePDF(facture, societe, client, {});
                                                } else {
                                                    alert("Client introuvable pour cette facture.");
                                                }
                                            };

                                            const handleSend = () => {
                                                alert(`Facture ${facture.numero} envoyée à ${client?.email || "l'adresse du client"}`);
                                            };

                                            return (
                                                <tr
                                                    key={facture.id}
                                                    onClick={() => handlePreview(facture)}
                                                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-6 py-4 font-medium text-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-4 w-4 text-purple-500" />
                                                            {facture.numero}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 max-w-[200px] truncate" title={client?.nom}>
                                                        {client?.nom || "Inconnu"}
                                                    </td>
                                                    <td className="px-6 py-4">{formatDateSafe(facture.dateEmission)}</td>
                                                    <td className="px-6 py-4">{formatDateSafe(facture.echeance)}</td>
                                                    <td className="px-6 py-4">{formatDateSafe(facture.datePaiement)}</td>
                                                    <td className="px-6 py-4 font-bold text-foreground">
                                                        {facture.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                    </td>
                                                    <td className="px-6 py-4">
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
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); router.push(`/factures/${facture.id}`); }} className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-md transition-colors cursor-pointer" title="Modifier"><Pencil className="h-4 w-4" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="p-1.5 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 rounded-md transition-colors cursor-pointer" title="Télécharger"><Download className="h-4 w-4" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleSend(); }} className="p-1.5 text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 rounded-md transition-colors cursor-pointer" title="Envoyer par email"><Send className="h-4 w-4" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(facture.id); }} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
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
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); router.push(`/factures/${facture.id}`); }} className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-orange-400 active:bg-white/10"><Pencil className="h-4 w-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); if (client) generateInvoicePDF(facture, societe, client, {}); }} className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-green-400 active:bg-white/10"><Download className="h-4 w-4" /></button>
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
                                        <option value="Brouillon">Brouillon</option>
                                        <option value="Envoyée">Envoyée</option>
                                        <option value="Payée">Payée</option>
                                        <option value="Retard">Retard</option>
                                        <option value="Annulée">Annulée</option>
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
                                    className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-white/10 rounded-lg transition-colors"
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
        </div>
    );
}
