"use client";

import { useData } from "@/components/data-provider";
import { useState } from "react";
import { Search, Plus, Filter, FileText, Receipt, ArrowUpRight, X, ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { toast } from "sonner";

interface MobileDocumentsProps {
    initialTab?: "FACTURE" | "DEVIS";
}

export function MobileDocuments({ initialTab = "FACTURE" }: MobileDocumentsProps) {
    const { invoices, quotes, clients, societe } = useData();
    const [activeTab, setActiveTab] = useState<"FACTURE" | "DEVIS">(initialTab);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    // -- Filter Options --
    const filters = [
        { id: "ALL", label: "Tout" },
        { id: "Payée", label: "Payées" }, // Facture only
        { id: "En attente", label: "En attente" }, // Facture: Envoyée/Retard, Devis: Envoyé
        { id: "Brouillon", label: "Brouillons" },
        { id: "Retard", label: "En retard" }, // Facture only
        { id: "Signé", label: "Signés" }, // Devis only
        { id: "Refusé", label: "Refusés" }, // Devis only
        { id: "Annulée", label: "Annulées" },
    ];

    // Filter available options based on Tab
    const activeFilters = filters.filter(f => {
        if (activeTab === "FACTURE") return !["Signé", "Refusé"].includes(f.id);
        if (activeTab === "DEVIS") return !["Payée", "Retard"].includes(f.id);
        return true;
    });

    const data = activeTab === "FACTURE" ? invoices : quotes;

    const filteredData = data.filter(item => {
        // 1. Text Search
        const clientName = clients.find(c => c.id === item.clientId)?.nom?.toLowerCase() || "";
        const matchesSearch =
            item.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
            clientName.includes(searchQuery.toLowerCase());

        // 2. Status Filter
        let matchesStatus = true;
        if (statusFilter !== "ALL") {
            if (statusFilter === "En attente") {
                matchesStatus = ["Envoyée", "Envoyé"].includes(item.statut);
            } else {
                matchesStatus = item.statut === statusFilter;
            }
        }

        // Hide deleted items (just in case)
        const isNotDeleted = !item.deletedAt;

        return matchesSearch && matchesStatus && isNotDeleted;
    }).sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime());

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Payée": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
            case "Signé":
            case "Accepté": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
            case "Envoyée":
            case "Envoyé": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
            case "Brouillon": return "text-slate-500 bg-slate-500/10 border-slate-500/20";
            case "Retard":
            case "Refusé": return "text-red-500 bg-red-500/10 border-red-500/20";
            case "Annulée": return "text-slate-400 bg-slate-400/10 border-slate-400/20 line-through";
            default: return "text-muted-foreground bg-muted border-white/10";
        }
    }
};

const handlePreview = (e: React.MouseEvent, doc: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (!societe) {
        toast.error("Données société manquantes");
        return;
    }

    const client = clients.find(c => c.id === doc.clientId);
    if (!client) {
        toast.error("Client introuvable");
        return;
    }

    // Hydrate doc for PDF generator (needs products names etc if missing, but usually stored in items)
    // Actually items are stored.
    // We probably need to ensure config is parsed.
    const previewDoc = { ...doc };

    try {
        const url = generateInvoicePDF(previewDoc, societe, client, { returnBlob: true });
        if (url && typeof url === 'string') {
            window.open(url, '_blank');
        }
    } catch (err) {
        console.error(err);
        toast.error("Erreur gérération PDF");
    }
};

return (
    <div className="flex flex-col h-screen pb-20 bg-background">
        {/* Extended Header */}
        <div className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted shrink-0">
                    <ArrowLeft className="h-6 w-6" />
                </Link>

                <div className="flex-1 flex items-center justify-end gap-2">
                    {showSearch ? (
                        <div className="flex-1 relative animate-in fade-in zoom-in-95 duration-200">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                autoFocus
                                placeholder={activeTab === "FACTURE" ? "Rechercher..." : "Rechercher..."}
                                className="w-full h-10 pl-9 pr-10 rounded-xl bg-muted/50 border-none text-sm focus:ring-1 focus:ring-primary"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <button
                                onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-between">
                            <h1 className="text-xl font-bold tracking-tight">Documents</h1>
                            <button
                                onClick={() => setShowSearch(true)}
                                className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                            >
                                <Search className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn("h-10 w-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all", showFilters ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground")}
                >
                    <Filter className="h-5 w-5" />
                </button>

                <Link href={activeTab === 'FACTURE' ? "/factures/new" : "/devis/new"} className="h-10 w-10 shrink-0 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 flex items-center justify-center active:scale-90 transition-transform">
                    <Plus className="h-6 w-6" />
                </Link>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 bg-muted/50 p-1 rounded-xl">
                <button
                    onClick={() => { setActiveTab("FACTURE"); setStatusFilter("ALL"); }}
                    className={cn(
                        "py-2 text-sm font-medium rounded-lg transition-all",
                        activeTab === "FACTURE" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Factures
                </button>
                <button
                    onClick={() => { setActiveTab("DEVIS"); setStatusFilter("ALL"); }}
                    className={cn(
                        "py-2 text-sm font-medium rounded-lg transition-all",
                        activeTab === "DEVIS" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Devis
                </button>
            </div>



            {/* Status Filters Scroll (Collapsible) */}
            {showFilters && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide animate-in slide-in-from-top-2 fade-in duration-200">
                    {activeFilters.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setStatusFilter(f.id)}
                            className={cn(
                                "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                                statusFilter === f.id
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredData.map((item) => {
                const client = clients.find(c => c.id === item.clientId);
                return (
                    <Link
                        key={item.id}
                        href={activeTab === 'FACTURE' ? `/factures/${item.id}` : `/devis/${item.id}`}
                        className="block group"
                    >
                        <div className="bg-card border border-border/50 p-4 rounded-2xl active:scale-[0.99] transition-all relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg", activeTab === 'FACTURE' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500")}>
                                        {activeTab === 'FACTURE' ? <Receipt className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-foreground">{item.numero}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{format(new Date(item.dateEmission), "d MMMM yyyy", { locale: fr })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handlePreview(e, item)}
                                        className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground active:scale-90 transition-transform"
                                    >
                                        <Eye className="h-5 w-5" />
                                    </button>
                                    {/* <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /> */}
                                </div>
                            </div>

                            <div className="flex justify-between items-end relative z-10">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">{client?.nom || "Inconnu"}</p>
                                    <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border", getStatusColor(item.statut))}>
                                        {item.statut}
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-foreground">{item.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                            </div>
                        </div>
                    </Link>
                );
            })}

            {filteredData.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                        <Filter className="h-5 w-5" />
                    </div>
                    <p className="text-sm">Aucun document trouvé</p>
                </div>
            )}
        </div>
    </div>
);
}
