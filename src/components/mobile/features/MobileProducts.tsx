"use client";

import { useData } from "@/components/data-provider";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, Search, Package, Box, Edit2, Trash2, Save, X, ArrowUpDown, Filter } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "../layout/BottomSheet";
import { toast } from "sonner";
import { createProduct, updateProduct, deleteProduct } from "@/lib/actions/products";
import { useRouter } from "next/navigation";

export function MobileProducts() {
    const { products } = useData();
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"nom_asc" | "nom_desc" | "prix_asc" | "prix_desc" | "sold_desc" | "sold_asc">("sold_desc");
    const [isEditing, setIsEditing] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null); // null = create, object = edit
    const [showSearch, setShowSearch] = useState(false);
    const [showFilters, setShowFilters] = useState(true);

    const filtered = products.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const soldA = a.soldCount || 0;
            const soldB = b.soldCount || 0;
            switch (sortBy) {
                case "nom_asc": return a.nom.localeCompare(b.nom);
                case "nom_desc": return b.nom.localeCompare(a.nom);
                case "prix_asc": return a.prixUnitaire - b.prixUnitaire;
                case "prix_desc": return b.prixUnitaire - a.prixUnitaire;
                case "sold_desc": return soldB - soldA;
                case "sold_asc": return soldA - soldB;
                default: return 0;
            }
        });

    // Header KPIs
    const avgPrice = products.length > 0 ? products.reduce((acc, p) => acc + p.prixUnitaire, 0) / products.length : 0;
    const totalProducts = products.length;

    const handleCreate = () => {
        setEditingProduct({ nom: "", description: "", prixUnitaire: 0, tva: 20 });
        setIsEditing(true);
    };

    const handleEdit = (p: any) => {
        setEditingProduct({ ...p });
        setIsEditing(true);
    };

    return (
        <div className="min-h-screen bg-muted/10 pb-24 font-sans">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="w-10" /> {/* Spacer for centering when arrows are removed */}
                    <div className="flex-1 flex items-center justify-end gap-2">
                        {showSearch ? (
                            <div className="flex-1 relative animate-in fade-in zoom-in-95 duration-200">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    autoFocus
                                    placeholder="Rechercher..."
                                    className="w-full h-10 pl-9 pr-10 rounded-xl bg-muted/50 border-none text-sm focus:ring-1 focus:ring-primary"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                <button
                                    onClick={() => { setShowSearch(false); setSearch(""); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-between">
                                <h1 className="text-xl font-bold">
                                    {products.length} {products.length > 1 ? "Produits" : "Produit"}
                                </h1>
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
                        onClick={handleCreate}
                        className="h-10 w-10 rounded-full bg-primary text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    >
                        <Plus className="h-6 w-6" />
                    </button>
                </div>

                {/* Filter Chips - Collapsible */}
                {showFilters && (
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide animate-in slide-in-from-top-2 fade-in duration-200">
                        {[
                            { id: "sold_desc", label: "Plus vendus" },
                            { id: "sold_asc", label: "Moins vendus" },
                            { id: "prix_desc", label: "Prix ↓" },
                            { id: "prix_asc", label: "Prix ↑" },
                            { id: "nom_asc", label: "A - Z" },
                            { id: "nom_desc", label: "Z - A" },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setSortBy(opt.id as any)}
                                className={cn(
                                    "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                                    sortBy === opt.id
                                        ? "bg-foreground text-background border-foreground"
                                        : "bg-card border-border hover:bg-muted text-muted-foreground"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Stats - Always Visible */}
            <div className="p-4 pb-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card p-3 rounded-xl border border-border/50 shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Prix Moyen</p>
                        <p className="text-lg font-bold">{avgPrice.toFixed(2)}€</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/50 shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">Total Produits</p>
                        <p className="text-lg font-bold">{totalProducts}</p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-3">
                {filtered.map((product, index) => (
                    <div key={product.id} className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all" onClick={() => handleEdit(product)}>
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                            index === 0 ? "bg-orange-500/20 border-orange-500/30" :
                                index === 1 ? "bg-orange-500/15 border-orange-500/20" :
                                    index === 2 ? "bg-orange-500/10 border-orange-500/15" :
                                        "bg-orange-500/5 border-orange-500/10"
                        )}>
                            <span className={cn(
                                "text-[10px] font-black mr-0.5",
                                index < 3 ? "text-orange-500/50" : "text-orange-500/30"
                            )}>#</span>
                            <span className={cn(
                                "text-sm font-bold text-foreground",
                                index < 3 ? "text-orange-500" : ""
                            )}>{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold truncate pr-2">{product.nom}</h3>
                                <span className="font-sans font-bold">{Number(product.prixUnitaire).toFixed(2)}€</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <p className="text-xs text-muted-foreground truncate max-w-[70%]">{product.description || "Aucune description"}</p>
                                {product.soldCount !== undefined && product.soldCount > 0 && (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-medium">
                                        {product.soldCount} ventes
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Aucun produit trouvé</p>
                    </div>
                )}
            </div>

            {/* Editor Sheet */}
            <ProductEditorSheet
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                product={editingProduct}
            />
        </div>
    );
}

function ProductEditorSheet({ isOpen, onClose, product }: { isOpen: boolean, onClose: () => void, product: any }) {
    const [formData, setFormData] = useState<any>(product || {});
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // Reset form when product changes
    if (product && formData.id !== product.id && formData.tempId !== product.tempId) {
        setFormData(product);
    }

    // Simple controlled inputs update
    const update = (field: string, val: any) => setFormData((prev: any) => ({ ...prev, [field]: val }));

    const handleSave = async () => {
        setIsLoading(true);
        try {
            if (formData.id) {
                await updateProduct(formData);
                toast.success("Produit modifié");
            } else {
                await createProduct(formData);
                toast.success("Produit créé");
            }
            onClose();
            router.refresh();
        } catch (e) {
            toast.error("Erreur lors de l'enregistrement");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Supprimer ce produit ?")) return;
        setIsLoading(true);
        try {
            await deleteProduct(formData.id);
            toast.success("Produit supprimé");
            onClose();
            router.refresh();
        } catch (e) {
            toast.error("Erreur lors de la suppression");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border p-6 rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">{formData.id ? "Modifier Produit" : "Nouveau Produit"}</h2>
                    <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-muted">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pb-20">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nom</label>
                        <input
                            value={formData.nom || ""}
                            onChange={e => update("nom", e.target.value)}
                            className="w-full p-3 rounded-xl bg-muted/50 border border-transparent focus:bg-background focus:border-primary transition-colors"
                            placeholder="Ex: Prestation Web"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <textarea
                            value={formData.description || ""}
                            onChange={e => update("description", e.target.value)}
                            className="w-full p-3 rounded-xl bg-muted/50 border border-transparent focus:bg-background focus:border-primary transition-colors min-h-[80px]"
                            placeholder="Description détaillée..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Prix HT</label>
                            <input
                                type="number"
                                value={formData.prixUnitaire || 0}
                                onChange={e => update("prixUnitaire", Number(e.target.value))}
                                className="w-full p-3 rounded-xl bg-muted/50 border border-transparent focus:bg-background focus:border-primary transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">TVA %</label>
                            <input
                                type="number"
                                value={formData.tva || 20}
                                onChange={e => update("tva", Number(e.target.value))}
                                className="w-full p-3 rounded-xl bg-muted/50 border border-transparent focus:bg-background focus:border-primary transition-colors"
                            />
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex gap-3">
                    {formData.id && (
                        <button
                            onClick={handleDelete}
                            disabled={isLoading}
                            className="h-12 w-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0"
                        >
                            <Trash2 className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="flex-1 h-12 rounded-xl bg-primary text-black font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Save className="h-5 w-5" />
                        {isLoading ? "Enregistrement..." : "Enregistrer"}
                    </button>
                </div>
            </div>
        </div>
    );
}
