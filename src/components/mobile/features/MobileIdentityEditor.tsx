"use client";

import { useData } from "@/components/data-provider";
import { updateSociete } from "@/app/actions";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, X, Building, Layout, Shield, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function MobileIdentityEditor() {
    const { societe, refreshData } = useData();
    const [isSaving, setIsSaving] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const { register, handleSubmit, reset, setValue } = useForm({
        defaultValues: { ...societe }
    });

    useEffect(() => {
        if (societe) {
            reset({ ...societe });
            setLogoPreview(societe.logoUrl || null);
        }
    }, [societe, reset]);

    // Image compression helper (copied from desktop)
    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 800;
                    let width = img.width;
                    let height = img.height;
                    // Maintain aspect ratio
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    const isPNG = file.type === 'image/png';
                    const format = isPNG ? 'image/png' : 'image/jpeg';
                    const quality = isPNG ? 1.0 : 0.8;
                    resolve(canvas.toDataURL(format, quality));
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Le fichier est trop volumineux (max 5MB)');
            return;
        }

        const loadingToast = toast.loading("Traitement...");
        try {
            const compressed = await compressImage(file);
            setLogoPreview(compressed);
            setValue("logoUrl", compressed, { shouldDirty: true });
            toast.success("Logo chargé");
        } catch (error) {
            toast.error("Erreur de traitement");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const onSubmit = async (data: any) => {
        setIsSaving(true);
        try {
            // Filter globalConfig if it exists in data but not needed here? 
            // updateSociete expects Partial<Societe>.
            // Removing globalConfig if present to be safe, though TS might ignore.
            const { globalConfig, ...cleanData } = data;

            await updateSociete(cleanData);
            refreshData();
            toast.success("Société mise à jour !");
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="pb-32 bg-background min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/settings" className="p-2 -ml-2 rounded-full hover:bg-muted">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="font-bold text-lg">Identité Société</h1>
                </div>
                <button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer
                </button>
            </div>

            <div className="p-4 space-y-6">

                {/* Logo Section */}
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                    <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-500" /> Logo
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="h-20 w-20 rounded-xl border border-border flex items-center justify-center bg-muted/30 overflow-hidden relative group">
                            {logoPreview ? (
                                <img src={logoPreview} alt="" className="h-full w-full object-contain" />
                            ) : (
                                <span className="text-xs text-muted-foreground">Aucun</span>
                            )}
                            {logoPreview && (
                                <button
                                    onClick={() => { setLogoPreview(null); setValue("logoUrl", ""); }}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-6 w-6 text-white" />
                                </button>
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground active:bg-muted transition-colors">
                                <Upload className="h-4 w-4" />
                                <span>Changer le logo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                        </div>
                    </div>
                </div>

                {/* General Info */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <Layout className="h-4 w-4 text-purple-500" /> Infos Générales
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Nom</label>
                            <input {...register("nom")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Email Contact</label>
                            <input {...register("email")} type="email" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1">Forme Jur.</label>
                                <input {...register("formeJuridique")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1">Capital</label>
                                <input {...register("capitalSocial")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Site Web</label>
                            <input {...register("siteWeb")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <Building className="h-4 w-4 text-orange-500" /> Adresse
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Adresse</label>
                            <input {...register("adresse")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1">Code Postal</label>
                                <input {...register("codePostal")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1">Ville</label>
                                <input {...register("ville")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Pays</label>
                            <input {...register("pays")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Legal */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-indigo-500" /> Mentions Légales
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1">SIRET</label>
                                <input {...register("siret")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1">RCS</label>
                                <input {...register("rcs")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">TVA Intra.</label>
                            <input {...register("tvaIntra")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Pied de page PDF</label>
                            <textarea {...register("mentionsLegales")} rows={3} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Bank */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-green-500" /> Banque
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Nom Banque</label>
                            <input {...register("banque")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">IBAN</label>
                            <input {...register("iban")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm font-mono" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">BIC</label>
                            <input {...register("bic")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm font-mono" />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
