"use client";

import { useParams, useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Produit } from "@/types";
import { createProduct, updateProduct, deleteRecord } from "@/app/actions";

import { toast } from "sonner";

export default function ProductEditPage() {
    const params = useParams();
    const router = useRouter();
    const { products, refreshData, societe, confirm, logAction, setIsDirty } = useData();
    const productId = params.id as string;

    const [formData, setFormData] = useState<Produit>({
        id: productId,
        nom: "",
        description: "",
        prixUnitaire: 0,
        tva: 20,
        societeId: societe?.id || "soc_1"
    });

    // Detect if we are editing an existing product
    const originalProduct = useMemo(() => products.find(p => p.id === productId), [products, productId]);

    useEffect(() => {
        if (originalProduct) {
            setFormData(originalProduct);
        }
    }, [originalProduct]);

    // Calculate Dirty State
    const isFormDirty = useMemo(() => {
        if (originalProduct) {
            return (
                formData.nom !== originalProduct.nom ||
                formData.description !== (originalProduct.description || "") ||
                formData.prixUnitaire !== originalProduct.prixUnitaire ||
                formData.tva !== originalProduct.tva
            );
        }
        // New Product: Dirty if any field is filled
        return formData.nom !== "" || formData.description !== "" || formData.prixUnitaire !== 0 || formData.tva !== 20;
    }, [formData, originalProduct]);

    // Sync with Global Navigation Guard
    useEffect(() => {
        setIsDirty(isFormDirty);
        return () => setIsDirty(false);
    }, [isFormDirty, setIsDirty]);

    const handleBack = () => {
        if (isFormDirty) {
            confirm({
                title: "Modifications non enregistrées",
                message: "Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?",
                onConfirm: () => router.push("/produits")
            });
        } else {
            router.push("/produits");
        }
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isNew = !products.find(p => p.id === productId);
            const productToSave = { ...formData };

            if (isNew) {
                // CREATE
                const res = await createProduct(productToSave);
                if (!res.success || !res.id) throw new Error(res.error || "Erreur création base de données");
                productToSave.id = res.id;
                logAction('create', 'produit', `Création du produit ${productToSave.nom}`, productToSave.id);
            } else {
                // UPDATE
                const res = await updateProduct(productToSave);
                if (!res.success) throw new Error(res.error || "Erreur mise à jour base de données");
                logAction('update', 'produit', `Mise à jour du produit ${productToSave.nom}`, productToSave.id);
            }

            await refreshData();
            setIsDirty(false); // Reset dirty state before navigation
            toast.success("Produit enregistré !");
            router.push("/produits");
        } catch (error: any) {
            console.error(error);
            toast.error("Erreur: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        confirm({
            title: "Supprimer le produit",
            message: "Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.",
            onConfirm: async () => {
                await deleteRecord('Produits', productId);
                logAction('delete', 'produit', `Suppression du produit ${formData.nom}`, productId);
                await refreshData();
                setIsDirty(false); // Reset dirty state
                toast.success("Produit supprimé");
                router.push("/produits");
            }
        });
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBack}
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
                                value={formData.prixUnitaire === 0 ? "" : formData.prixUnitaire}
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
