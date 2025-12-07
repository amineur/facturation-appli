"use client";

import { useState, useEffect } from "react";
import { Trash2, RotateCcw, X, FileText, Receipt, Filter, Search } from "lucide-react";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Facture, Devis } from "@/types";
import { cn } from "@/lib/utils";

type DeletedItem = (Facture | Devis) & { itemType: "Facture" | "Devis" };

export default function TrashPage() {
    const { refreshData, clients } = useData();
    const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
    const [filter, setFilter] = useState<"ALL" | "FACTURE" | "DEVIS">("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    // Load deleted items
    const loadDeletedItems = () => {
        const invoices = dataService.getDeletedInvoices().map(i => ({ ...i, itemType: "Facture" as const }));
        const quotes = dataService.getDeletedQuotes().map(q => ({ ...q, itemType: "Devis" as const }));
        // Sort by deletedAt desc (most recently deleted first)
        const combined = [...invoices, ...quotes].sort((a, b) => {
            const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return dateB - dateA;
        });
        setDeletedItems(combined);
    };

    useEffect(() => {
        loadDeletedItems();
    }, []);

    const handleRestore = (item: DeletedItem) => {
        if (confirm(`Voulez-vous restaurer ${item.itemType === "Facture" ? "cette facture" : "ce devis"} ?`)) {
            if (item.itemType === "Facture") {
                dataService.restoreInvoice(item.id);
            } else {
                dataService.restoreQuote(item.id);
            }
            loadDeletedItems();
            refreshData();
        }
    };

    const handlePermanentDelete = (item: DeletedItem) => {
        if (confirm(`Suppression définitive. Cette action est irréversible. Continuer ?`)) {
            if (item.itemType === "Facture") {
                dataService.permanentlyDeleteInvoice(item.id);
            } else {
                dataService.permanentlyDeleteQuote(item.id);
            }
            loadDeletedItems();
            refreshData();
        }
    };

    const handleEmptyTrash = () => {
        if (confirm("Voulez-vous vider la corbeille ? Tous les éléments seront supprimés définitivement.")) {
            deletedItems.forEach(item => {
                if (item.itemType === "Facture") {
                    dataService.permanentlyDeleteInvoice(item.id);
                } else {
                    dataService.permanentlyDeleteQuote(item.id);
                }
            });
            loadDeletedItems();
            refreshData();
        }
    };

    const filteredItems = deletedItems.filter(item => {
        const matchesType = filter === "ALL" || item.itemType.toUpperCase() === filter;

        const searchLower = searchTerm.toLowerCase();
        const client = clients.find(c => c.id === item.clientId); // Now we have clients
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
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Corbeille</h2>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-muted-foreground">
                            {deletedItems.length} élément(s) supprimé(s)
                        </p>
                    </div>
                </div>
                {deletedItems.length > 0 && (
                    <button
                        onClick={handleEmptyTrash}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
                    >
                        <Trash2 className="h-4 w-4" />
                        Vider la corbeille
                    </button>
                )}
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
                    <Trash2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        {filter === "ALL" ? "Corbeille vide" : `Aucun ${filter === "FACTURE" ? "facture" : "devis"} supprimé`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Les éléments supprimés apparaîtront ici
                    </p>
                </div>
            ) : (
                <div className="glass-card rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-muted-foreground">
                        <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Numéro</th>
                                <th className="px-6 py-4 font-medium">Date de suppression</th>
                                <th className="px-6 py-4 font-medium">Montant TTC</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredItems.map((item) => (
                                <tr key={`${item.itemType}-${item.id}`} className="hover:bg-white/5 transition-colors">
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
                                    <td className="px-6 py-4">
                                        {item.deletedAt
                                            ? format(new Date(item.deletedAt), "dd MMM yyyy HH:mm", { locale: fr })
                                            : "-"}
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
                                                onClick={() => handleRestore(item)}
                                                className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors"
                                                title="Restaurer"
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handlePermanentDelete(item)}
                                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                                title="Supprimer définitivement"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
