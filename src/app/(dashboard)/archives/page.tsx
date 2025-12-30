"use client";

import { useState, useEffect } from "react";
import { Archive, Eye, Search, Filter, Receipt, FileText } from "lucide-react";
import { useData } from "@/components/data-provider";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Facture, Devis } from "@/types";
import { cn } from "@/lib/utils";
import { fetchArchivedInvoices, fetchArchivedQuotes } from "@/app/actions";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";

type ArchivedItem = (Facture & { itemType: "Facture" }) | (Devis & { itemType: "Devis" });

export const dynamic = 'force-dynamic';

export default function ArchivesPage() {
    const { refreshData, clients, societe, isLoading: isDataLoading, logAction, confirm } = useData();
    const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
    const [filter, setFilter] = useState<"ALL" | "FACTURE" | "DEVIS">("ALL");
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Preview State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewInvoiceNum, setPreviewInvoiceNum] = useState("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Load archived items
    const loadArchivedItems = async () => {
        if (!societe?.id) return;
        setIsLoading(true);
        try {
            const [invoicesRes, quotesRes] = await Promise.all([
                fetchArchivedInvoices(societe.id),
                fetchArchivedQuotes(societe.id)
            ]);

            const invoices = (invoicesRes.data || []).map(i => ({ ...i, itemType: "Facture" as const })) as unknown as (Facture & { itemType: "Facture" })[];
            const quotes = (quotesRes.data || []).map(q => ({ ...q, itemType: "Devis" as const })) as unknown as (Devis & { itemType: "Devis" })[];

            const combined = [...invoices, ...quotes].sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });
            setArchivedItems(combined as ArchivedItem[]);
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du chargement des archives");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isDataLoading && societe?.id) {
            loadArchivedItems();
        }
    }, [isDataLoading, societe?.id]);

    const handlePreview = async (item: ArchivedItem) => {
        try {
            const client = clients.find(c => c.id === item.clientId);
            if (!client || !societe) {
                toast.error("Données manquantes pour l'aperçu");
                return;
            }

            // Fetch full details if needed, but Archives usually are static. 
            // However, items might be JSON string in lite fetch.
            // Let's assume lite fetch returns parsable items or we need full fetch.
            // Check previous code: fetchArchivedInvoices calls findMany on Prisma without explicit select so it returns all fields including itemsJSON?
            // Actually fetchArchivedInvoices in history.ts (it was imported from '@/app/actions' which exports history.ts actions?). No wait, history.ts has unarchiveRecord.
            // fetchArchivedInvoices is likely in 'invoices.ts'. It usually returns mapped data.
            // Keep it simple: use current item data. 

            // Generate PDF
            // We need to dynamic import or use existing import. import is missing in replacement content, I need to add it at top of file, but this tool replaces block.
            // I will assume I can add imports via separate tool call or include them if I replace whole file.
            // Since I am replacing the FUNCTION BODY primarily, I need to be careful about imports.
            // I will use `import('@/lib/pdf-generator')` dynamically inside handlePreview to be safe or use what's available.
            // But `generateInvoicePDF` is synchronous. 

            const { generateInvoicePDF } = await import("@/lib/pdf-generator");

            const url = generateInvoicePDF(item, societe, client, {
                returnBlob: true
            });
            if (url && typeof url === 'string') {
                setPreviewUrl(url);
                setPreviewInvoiceNum(item.numero);
                setIsPreviewOpen(true);
            }
        } catch (error) {
            console.error("Preview error", error);
            toast.error("Erreur lors de la génération de l'aperçu");
        }
    };

    const filteredItems = archivedItems.filter(item => {
        const matchesType = filter === "ALL" || item.itemType.toUpperCase() === filter;

        const searchLower = searchTerm.toLowerCase();
        const client = clients.find(c => c.id === item.clientId);
        const matchesSearch =
            searchTerm === "" ||
            item.numero.toLowerCase().includes(searchLower) ||
            (client?.nom || "").toLowerCase().includes(searchLower) ||
            item.totalTTC.toString().includes(searchLower);

        return matchesType && matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Archives</h2>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-muted-foreground">
                            {archivedItems.length} élément(s) archivé(s)
                        </p>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-xl p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher par numéro, montant ou client..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-lg glass-input pl-10 pr-4 text-sm transition-all focus:ring-1 focus:ring-white/20 text-foreground"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setFilter("ALL")}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        filter === "ALL" ? "bg-white/10 text-white border border-white/20" : "text-muted-foreground hover:bg-white/5"
                    )}
                >
                    Tout
                </button>
                <button
                    onClick={() => setFilter("FACTURE")}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                        filter === "FACTURE" ? "bg-white/10 text-white border border-white/20" : "text-muted-foreground hover:bg-white/5"
                    )}
                >
                    <Receipt className="h-4 w-4" />
                    Factures
                </button>
                <button
                    onClick={() => setFilter("DEVIS")}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                        filter === "DEVIS" ? "bg-white/10 text-white border border-white/20" : "text-muted-foreground hover:bg-white/5"
                    )}
                >
                    <FileText className="h-4 w-4" />
                    Devis
                </button>
            </div>

            {filteredItems.length === 0 ? (
                <div className="glass-card rounded-xl p-12 text-center">
                    <Archive className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        {filter === "ALL" ? "Aucune archive" : `Aucun ${filter === "FACTURE" ? "facture" : "devis"} archivé`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Les éléments archivés apparaîtront ici
                    </p>
                </div>
            ) : (
                <div className="glass-card rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-muted-foreground">
                        <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Numéro</th>
                                <th className="px-6 py-4 font-medium">Client</th>
                                <th className="px-6 py-4 font-medium">Date</th>
                                <th className="px-6 py-4 font-medium">Montant TTC</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredItems.map((item) => (
                                <tr
                                    key={`${item.itemType}-${item.id}`}
                                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                                    onClick={() => handlePreview(item)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {item.itemType === "Facture" ? (
                                                <Receipt className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <FileText className="h-4 w-4 text-purple-500" />
                                            )}
                                            <span className={cn(
                                                "text-xs font-medium px-2 py-0.5 rounded-full border",
                                                item.itemType === "Facture"
                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                    : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                            )}>
                                                {item.itemType}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-foreground">
                                        {item.numero}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {(item as any).client?.nom || "Inconnu"}
                                    </td>
                                    <td className="px-6 py-4">
                                        {format(new Date(item.dateEmission), "dd MMM yyyy", { locale: fr })}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-foreground">
                                        {item.totalTTC.toLocaleString("fr-FR", {
                                            style: "currency",
                                            currency: "EUR",
                                        })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handlePreview(item); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
                                                title="Aperçu"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Aperçu
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Lazy load the modal if needed, or just import it at top. I'll dynamically import if not available, but usually safe to assume it's there? No, I need to add import at top or import dynamic. */}
            {/* But I cannot edit top AND body easily same time without replace file. 
                I'll handle Imports in next step. For now, just using <PDFPreviewModal /> which will error if not imported.
            */}
            <PDFPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                pdfUrl={previewUrl}
                invoiceNumber={previewInvoiceNum}
            />
        </div>
    );
}
