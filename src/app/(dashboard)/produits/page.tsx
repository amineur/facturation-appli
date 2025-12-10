"use client";

import { useState, useRef, useMemo } from "react";
import { Plus, Search, MoreHorizontal, Tag, Package, Upload, LayoutGrid, List as ListIcon, ArrowUpDown, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { Produit } from "@/types";
import { cn } from "@/lib/utils";

type ViewMode = "GRID" | "LIST";
type SortOption = "NAME_ASC" | "NAME_DESC" | "PRICE_ASC" | "PRICE_DESC" | "SALES_DESC" | "SALES_ASC";

export default function ProductsPage() {
    const { products, refreshData, societe, invoices } = useData();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("LIST");
    const [sortOption, setSortOption] = useState<SortOption>("SALES_DESC");

    // Metrics Calculation
    const totalProducts = products.length;
    const averagePrice = totalProducts > 0
        ? products.reduce((acc, p) => acc + p.prixUnitaire, 0) / totalProducts
        : 0;
    const maxPriceProduct = products.length > 0
        ? products.reduce((prev, current) => (prev.prixUnitaire > current.prixUnitaire) ? prev : current)
        : null;

    // Calculate Sales Volume per Product
    const productSales = useMemo(() => {
        const sales = new Map<string, number>();
        invoices.forEach(invoice => {
            try {
                const items = invoice.items || [];
                items.forEach((item: any) => {
                    // Try to match by ID first (if we have it in items), otherwise by name
                    // Assuming items have productId or we match by name for legacy/simplicity
                    // Ideally invoices items should link to product ID.
                    // If invoice items structure is { productId: string, name: string, quantity: number, ... }

                    if (item.produitId) {
                        sales.set(item.produitId, (sales.get(item.produitId) || 0) + (item.quantite || 0));
                    } else if (item.nom || item.description) {
                        // Fallback match by name/description if ID missing
                        const identifier = item.nom || item.description;
                        const product = products.find(p => p.nom === identifier);
                        if (product) {
                            sales.set(product.id, (sales.get(product.id) || 0) + (item.quantite || 0));
                        }
                    }
                });
            } catch (e) {
                console.error("Error parsing invoice items", e);
            }
        });
        return sales;
    }, [invoices, products]);

    // Filtering & Sorting
    const filteredProducts = products
        .filter((produit) =>
            produit.nom.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            switch (sortOption) {
                case "NAME_ASC": return a.nom.localeCompare(b.nom);
                case "NAME_DESC": return b.nom.localeCompare(a.nom);
                case "PRICE_ASC": return a.prixUnitaire - b.prixUnitaire;
                case "PRICE_DESC": return b.prixUnitaire - a.prixUnitaire;
                case "SALES_DESC": return (productSales.get(b.id) || 0) - (productSales.get(a.id) || 0);
                case "SALES_ASC": return (productSales.get(a.id) || 0) - (productSales.get(b.id) || 0);
                default: return 0;
            }
        });

    return (
        <div className="space-y-8">
            {/* ... Header & Metrics ... */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Produits & Services</h2>
                    <p className="text-muted-foreground">Gérez votre catalogue de prestations.</p>
                </div>

                <div className="glass-card p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Produits</p>
                        <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Package className="h-5 w-5" />
                    </div>
                </div>

                <div className="glass-card p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prix Moyen HT</p>
                        <p className="text-2xl font-bold text-foreground">
                            {averagePrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                        </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Tag className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-card p-4 rounded-xl">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher un produit..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-lg glass-input pl-10 pr-4 text-sm transition-all focus:ring-1 focus:ring-white/20 text-foreground"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* Sort Dropdown */}
                    <div className="relative">
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className="h-10 pl-3 pr-8 rounded-lg text-sm appearance-none cursor-pointer text-foreground bg-white/5 border border-white/10 hover:bg-white/10 focus:ring-0 transition-colors"
                        >
                            <option value="SALES_DESC" className="bg-[#1a1a1a]">Plus vendus</option>
                            <option value="SALES_ASC" className="bg-[#1a1a1a]">Moins vendus</option>
                            <option value="NAME_ASC" className="bg-[#1a1a1a]">Nom (A-Z)</option>
                            <option value="NAME_DESC" className="bg-[#1a1a1a]">Nom (Z-A)</option>
                            <option value="PRICE_ASC" className="bg-[#1a1a1a]">Prix Croissant</option>
                            <option value="PRICE_DESC" className="bg-[#1a1a1a]">Prix Décroissant</option>
                        </select>
                        <ArrowUpDown className="absolute right-2 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>

                    <div className="h-6 w-[1px] bg-white/10 mx-1"></div>

                    {/* View Toggle */}
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setViewMode("GRID")}
                            className={cn(
                                "p-2 rounded-md transition-all",
                                viewMode === "GRID" ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("LIST")}
                            className={cn(
                                "p-2 rounded-md transition-all",
                                viewMode === "LIST" ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <ListIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="h-6 w-[1px] bg-white/10 mx-1"></div>

                    <button
                        onClick={() => router.push("/produits/new")}
                        className="flex items-center gap-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 text-sm font-medium transition-colors shadow-lg shadow-pink-500/20"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">Nouveau</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === "GRID" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((produit) => (
                        <div
                            key={produit.id}
                            onClick={() => router.push(`/produits/${produit.id}`)}
                            className="group glass-card rounded-xl p-0 overflow-hidden hover:border-pink-500/30 transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-pink-500/5 hover:-translate-y-1"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-foreground">
                                            {produit.prixUnitaire.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                        </p>
                                        <p className="text-xs text-muted-foreground">HT</p>
                                    </div>
                                </div>

                                <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1 group-hover:text-pink-400 transition-colors">
                                    {produit.nom}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
                                    {produit.description || "Aucune description"}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-muted-foreground border border-white/5">
                                        <Tag className="h-3 w-3" />
                                        TVA {produit.tva}%
                                    </span>
                                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                        Modifier →
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-primary/10 text-xs uppercase text-muted-foreground font-medium">
                            <tr>
                                <th className="px-6 py-4">Nom du produit</th>
                                <th className="px-6 py-4 text-center">Ventes</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4 text-right">Prix HT</th>
                                <th className="px-6 py-4 text-center">TVA</th>
                                <th className="px-6 py-4 text-right">Prix TTC</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.map((produit) => (
                                <tr
                                    key={produit.id}
                                    onClick={() => router.push(`/produits/${produit.id}`)}
                                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 font-medium text-foreground">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded bg-pink-500/10 flex items-center justify-center text-pink-500">
                                                <Package className="h-4 w-4" />
                                            </div>
                                            {produit.nom}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/10">
                                            {productSales.get(produit.id) || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">
                                        {produit.description || "-"}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-foreground">
                                        {produit.prixUnitaire.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-2 py-0.5 rounded text-xs bg-white/5 text-muted-foreground">
                                            {produit.tva}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-muted-foreground">
                                        {(produit.prixUnitaire * (1 + produit.tva / 100)).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-xs font-medium text-pink-500 hover:text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Modifier
                                        </button>
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
