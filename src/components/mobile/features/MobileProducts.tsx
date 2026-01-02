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
    const { products, invoices } = useData();
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"nom_asc" | "nom_desc" | "prix_asc" | "prix_desc" | "sold_desc" | "sold_asc">("nom_asc");
    const [isEditing, setIsEditing] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null); // null = create, object = edit
    const [showSort, setShowSort] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Calculate Sales Stats for each product
    const productStats = products.map(p => {
        let soldCount = 0;
        invoices.forEach(inv => {
            if (["Payée", "Envoyée"].includes(inv.statut)) {
                inv.items?.forEach(item => {
                    // Loose matching by description as we might not have ID link in legacy data
                    if (item.description === p.nom || item.description?.includes(p.nom)) {
                        soldCount += Number(item.quantite || 0);
                    }
                });
            }
        });
        return { ...p, soldCount };
    });

    const filtered = productStats.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            switch (sortBy) {
                case "nom_asc": return a.nom.localeCompare(b.nom);
                case "nom_desc": return b.nom.localeCompare(a.nom);
                case "prix_asc": return a.prixUnitaire - b.prixUnitaire;
                case "prix_desc": return b.prixUnitaire - a.prixUnitaire;
                case "sold_desc": return b.soldCount - a.soldCount;
                case "sold_asc": return a.soldCount - b.soldCount;
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
        <div className="min-h-screen bg-muted/10 pb-24">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between">
                <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <div className="flex-1 px-4 flex items-center justify-end gap-2">
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
                            <h1 className="text-lg font-bold">Produits</h1>
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
                    onClick={() => setShowSort(!showSort)}
                    className={cn("h-10 w-10 mr-2 rounded-full flex items-center justify-center transition-colors", showSort ? "bg-primary text-black" : "bg-muted text-muted-foreground")}
                >
                    <ArrowUpDown className="h-5 w-5" />
                </button>
                <button
                    onClick={handleCreate}
                    className="h-10 w-10 rounded-full bg-primary text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                    <Plus className="h-6 w-6" />
                </button>
            </div>

            {/* Sort & KPIs */}
            {showSort && (
                <div className="bg-background/95 backdrop-blur border-b border-white/10 p-4 space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { id: "sold_desc", label: "Plus vendus" },
                            { id: "sold_asc", label: "Moins vendus" },
                            { id: "prix_desc", label: "Prix décroissant" },
                            { id: "prix_asc", label: "Prix croissant" },
                            { id: "nom_asc", label: "A - Z" },
                            { id: "nom_desc", label: "Z - A" },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setSortBy(opt.id as any)}
                                className={cn(
                                    "whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium border transition-colors",
                                    sortBy === opt.id
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                            <p className="text-xs text-muted-foreground">Prix Moyen</p>
                            <p className="font-bold">{avgPrice.toFixed(2)}€</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                            <p className="text-xs text-muted-foreground">Total Produits</p>
                            <p className="font-bold">{totalProducts}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="p-4 space-y-3">
                {filtered.map(product => (
                    <div key={product.id} className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all" onClick={() => handleEdit(product)}>
                        <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                            <Box className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold truncate pr-2">{product.nom}</h3>
                                <span className="font-mono font-bold">{Number(product.prixUnitaire).toFixed(2)}€</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <p className="text-xs text-muted-foreground truncate max-w-[70%]">{product.description || "Aucune description"}</p>
                                {product.soldCount > 0 && (
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
