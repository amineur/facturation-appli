"use client";

import { useParams, useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Produit } from "@/types";

export default function ProductEditPage() {
    const params = useParams();
    const router = useRouter();
    const { products, refreshData, societe } = useData();
    const productId = params.id as string;

    const [formData, setFormData] = useState<Produit>({
        id: productId,
        nom: "",
        description: "",
        prixUnitaire: 0,
        tva: 20,
        societeId: societe?.id || "soc_1"
    });

    useEffect(() => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setFormData(product);
        }
    }, [productId, products]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        dataService.saveProduct(formData);
        refreshData();
        alert("Produit mis à jour avec succès !");
        router.push("/produits");
    };

    const handleDelete = () => {
        if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
            dataService.deleteProduct(productId);
            refreshData();
            router.push("/produits");
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push("/produits")}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Modifier le Produit</h2>
                    <p className="text-muted-foreground mt-1">Édition de {formData.nom || "produit"}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="glass-card rounded-xl p-8 space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                            Nom du Produit *
                        </label>
                        <input
                            type="text"
                            value={formData.nom}
                            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            required
                            className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                            placeholder="Ex: Développement Web"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                            Description
                        </label>
                        <textarea
                            value={formData.description || ""}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full rounded-lg glass-input px-4 py-3 text-foreground resize-none"
                            placeholder="Description du produit ou service..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-muted-foreground">
                                Prix Unitaire HT (€) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.prixUnitaire}
                                onChange={(e) => setFormData({ ...formData, prixUnitaire: parseFloat(e.target.value) || 0 })}
                                required
                                className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-muted-foreground">
                                TVA (%) *
                            </label>
                            <select
                                value={formData.tva}
                                onChange={(e) => setFormData({ ...formData, tva: parseFloat(e.target.value) })}
                                className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                            >
                                <option value="0">0%</option>
                                <option value="5.5">5.5%</option>
                                <option value="10">10%</option>
                                <option value="20">20%</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Prix TTC</span>
                            <span className="font-bold text-foreground">
                                {(formData.prixUnitaire * (1 + formData.tva / 100)).toLocaleString("fr-FR", {
                                    style: "currency",
                                    currency: "EUR"
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        Enregistrer
                    </button>
                </div>
            </form>
        </div>
    );
}
