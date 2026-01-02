"use client";

import { useData } from "@/components/data-provider";
import { useState } from "react";
import { Search, Plus, Filter, FileText, Receipt, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface MobileDocumentsProps {
    initialTab?: "FACTURE" | "DEVIS";
}

export function MobileDocuments({ initialTab = "FACTURE" }: MobileDocumentsProps) {
    const { invoices, quotes, clients } = useData();
    const [activeTab, setActiveTab] = useState<"FACTURE" | "DEVIS">(initialTab);
    const [searchQuery, setSearchQuery] = useState("");
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
    };

    return (
        <div className="flex flex-col h-screen pb-20 bg-background">
            {/* Extended Header */}
            <div className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30 pt-4 px-4 pb-2 space-y-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
                    <Link href={activeTab === 'FACTURE' ? "/factures/new" : "/devis/new"} className="p-2 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 active:scale-90 transition-transform">
                        <Plus className="h-5 w-5" />
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

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder={activeTab === "FACTURE" ? "Rechercher une facture..." : "Rechercher un devis..."}
                        className="w-full bg-card h-9 pl-9 pr-4 rounded-xl border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Status Filters Scroll */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
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
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
