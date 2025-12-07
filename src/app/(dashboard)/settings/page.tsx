"use client";

import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { Societe } from "@/types";
import { Save, Building, FileText, CreditCard, ChevronRight, Lock, Shield, Users, Layers, Layout, Key, PenTool, ArrowLeft, ChevronLeft, Database, Mail, Plus, Check, User, Upload, X, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProEditor } from "@/components/features/ProEditor";
import { DataManagement } from "@/components/features/DataManagement";
import { UserManagement } from "@/components/features/UserManagement";
import { EmailSettings } from "@/components/features/EmailSettings";

interface SettingsFormData extends Societe {
    globalConfig: any;
}

type SettingsView = "MAIN" | "IDENTITY" | "USERS" | "EMAIL" | "ADVANCED" | "PRO_EDITOR" | "DATA" | "CREATE_SOCIETE";

export default function SettingsPage() {
    const { societe, refreshData, createSociete } = useData();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Get view from URL or default to MAIN
    const activeView = (searchParams.get("view") as SettingsView) || "MAIN";

    // Helper to update URL without adding to history stack (optional, or use push)
    const setActiveView = useCallback((view: SettingsView) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", view);
        router.push(pathname + "?" + params.toString());
    }, [pathname, router, searchParams]);

    const [isSaving, setIsSaving] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // ... existing hook calls and onSubmit remain the same ...

    const { register, handleSubmit, reset } = useForm<SettingsFormData>({
        defaultValues: {
            ...societe,
            globalConfig: dataService.getGlobalConfig()
        }
    });

    useEffect(() => {
        if (societe) {
            reset({
                ...societe,
                globalConfig: dataService.getGlobalConfig()
            });
            setLogoPreview(societe.logoUrl || null);
        }
    }, [societe, reset]);

    // Image compression helper
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

                    // Preserve transparency for PNG, use JPEG for others
                    const isPNG = file.type === 'image/png';
                    const format = isPNG ? 'image/png' : 'image/jpeg';
                    const quality = isPNG ? 1.0 : 0.8; // PNG needs quality 1.0

                    const compressed = canvas.toDataURL(format, quality);
                    resolve(compressed);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (5MB max before compression)
        if (file.size > 5 * 1024 * 1024) {
            alert('Le fichier est trop volumineux (max 5MB)');
            return;
        }

        try {
            const compressed = await compressImage(file);
            setLogoPreview(compressed);

            // Update form data
            if (societe) {
                const updatedSociete = { ...societe, logoUrl: compressed };
                dataService.updateSociete(updatedSociete);
                refreshData();
            }
        } catch (error) {
            console.error('Erreur lors du traitement de l\'image:', error);
            alert('Erreur lors du traitement de l\'image');
        }
    };

    const handleRemoveLogo = () => {
        setLogoPreview(null);
        if (societe) {
            const updatedSociete = { ...societe, logoUrl: '' };
            dataService.updateSociete(updatedSociete);
            refreshData();
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const fakeEvent = {
                target: { files: [file] }
            } as any;
            await handleLogoUpload(fakeEvent);
        }
    };

    const onSubmit = async (data: SettingsFormData) => {
        setIsSaving(true);
        try {
            const { globalConfig, ...societeData } = data;
            dataService.updateSociete(societeData);
            dataService.saveGlobalConfig(globalConfig);
            refreshData();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    // ... helper components remain the same ...
    const SettingsItem = ({ icon: Icon, label, color, onClick }: { icon: any, label: string, color: string, onClick?: () => void }) => (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between p-4 glass-card hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/5 last:border-0 group text-left"
        >
            <div className="flex items-center gap-3">
                <div className={cn("p-1.5 rounded-md", color)}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="font-medium text-foreground">{label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
    );

    const SettingsSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="space-y-2">
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {title}
            </h3>
            <div className="flex flex-col rounded-xl overflow-hidden glass-card border border-white/10">
                {children}
            </div>
        </div>
    );

    if (activeView === "PRO_EDITOR") {
        return (
            <div className="h-full flex flex-col p-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex-1 overflow-hidden">
                    <ProEditor onBack={() => setActiveView("MAIN")} />
                </div>
            </div>
        );
    }

    if (activeView === "DATA") {
        return (
            <div className="h-full flex flex-col p-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex-1 overflow-y-auto">
                    <DataManagement onBack={() => setActiveView("MAIN")} />
                </div>
            </div>
        );
    }

    if (activeView === "USERS") {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => setActiveView("MAIN")}
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Réglages
                    </button>
                </div>
                <UserManagement onBack={() => setActiveView("MAIN")} />
            </div>
        );
    }

    if (activeView === "EMAIL") {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => setActiveView("MAIN")}
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Réglages
                    </button>
                </div>
                <EmailSettings />
            </div>
        );
    }

    if (activeView === "MAIN") {
        return (
            <div className="max-w-3xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Réglages
                    </h1>
                </div>

                <div className="space-y-8">
                    {/* SECTION: Utilisateurs & Sécurité */}
                    <SettingsSection title="Utilisateurs & Sécurité">
                        <SettingsItem
                            icon={Shield}
                            label="Gestion des utilisateurs"
                            color="bg-green-500"
                            onClick={() => setActiveView("USERS")}
                        />
                    </SettingsSection>

                    {/* SECTION: Fonctionnalités avancées */}
                    <SettingsSection title="Fonctionnalités avancées">
                        <SettingsItem
                            icon={PenTool}
                            label="Éditeur Pro"
                            color="bg-purple-500"
                            onClick={() => setActiveView("PRO_EDITOR")}
                        />
                        <SettingsItem
                            icon={Layers}
                            label="Modèles & Templates"
                            color="bg-pink-500"
                            onClick={() => setActiveView("ADVANCED")}
                        />
                        <SettingsItem
                            icon={Key}
                            label="Signatures & Mentions"
                            color="bg-yellow-500"
                            onClick={() => setActiveView("ADVANCED")}
                        />
                        <SettingsItem
                            icon={Plus}
                            label="Ajouter une société"
                            color="bg-orange-500"
                            onClick={() => setActiveView("CREATE_SOCIETE")}
                        />
                    </SettingsSection>

                    {/* SECTION: Identité & Société */}
                    <SettingsSection title="Identité & Société">
                        <SettingsItem
                            icon={Building}
                            label="Informations de la société"
                            color="bg-indigo-500"
                            onClick={() => setActiveView("IDENTITY")}
                        />
                        <SettingsItem
                            icon={Mail}
                            label="Configuration Email Société"
                            color="bg-blue-500"
                            onClick={() => setActiveView("EMAIL")}
                        />
                        <SettingsItem
                            icon={Database}
                            label="Gestion des données"
                            color="bg-emerald-500"
                            onClick={() => setActiveView("DATA")}
                        />
                    </SettingsSection>
                </div>
            </div>
        );
    }

    if (activeView === "CREATE_SOCIETE") {
        return <CreateSocieteView onBack={() => setActiveView("MAIN")} />;
    }

    if (activeView === "IDENTITY") {
        return (
            <div className="max-w-5xl mx-auto p-6 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => setActiveView("MAIN")}
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Réglages
                    </button>
                    <button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                </div>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-foreground">Identité & Entreprise</h1>
                    <p className="text-muted-foreground mt-1">Gérez les informations légales et bancaires de votre société.</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-20">
                    {/* Logo Upload Section */}
                    <div className="glass-card p-6 rounded-2xl">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                                <ImageIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Logo de l'entreprise</h2>
                                <p className="text-xs text-muted-foreground">Affiché sur vos factures et documents</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Upload Zone */}
                            <div>
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={cn(
                                        "relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer",
                                        isDragging
                                            ? "border-blue-400 bg-blue-500/10"
                                            : "border-white/20 hover:border-white/40 hover:bg-white/5"
                                    )}
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                                            <Upload className="h-6 w-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Glissez une image ici ou cliquez
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                PNG, JPG ou SVG (max 5MB)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 px-1">
                                    L'image sera automatiquement redimensionnée et optimisée
                                </p>
                            </div>

                            {/* Logo Preview */}
                            <div>
                                <div className="glass-card p-4 rounded-xl border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-medium text-muted-foreground">Aperçu</span>
                                        {logoPreview && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveLogo}
                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                                                title="Supprimer le logo"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview}
                                                alt="Logo"
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        ) : (
                                            <div className="text-center p-6">
                                                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                                                <p className="text-xs text-muted-foreground">Aucun logo</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Informations Entreprise */}
                        <div className="glass-card p-6 rounded-2xl space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                                <div className="p-2 rounded-lg bg-blue-500/10">
                                    <Building className="h-5 w-5 text-blue-400" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Identité Entreprise</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Nom de l'entreprise</label>
                                        <input
                                            {...register("nom")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                            placeholder="Votre société"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Forme juridique</label>
                                        <input
                                            {...register("formeJuridique")}
                                            placeholder="SAS, SARL..."
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Capital</label>
                                        <input
                                            {...register("capitalSocial")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                            placeholder="1000 €"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Adresse complète</label>
                                    <textarea
                                        {...register("adresse")}
                                        rows={2}
                                        className="w-full glass-input px-4 py-2.5 rounded-xl text-sm min-h-[80px]"
                                        placeholder="Adresse postale..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Code postal</label>
                                        <input
                                            {...register("codePostal")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Ville</label>
                                        <input
                                            {...register("ville")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Email</label>
                                        <input
                                            {...register("email")}
                                            type="email"
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Téléphone</label>
                                        <input
                                            {...register("telephone")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Site web</label>
                                    <input
                                        {...register("siteWeb")}
                                        className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Informations Légales */}
                            <div className="glass-card p-6 rounded-2xl space-y-6">
                                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                                    <div className="p-2 rounded-lg bg-purple-500/10">
                                        <FileText className="h-5 w-5 text-purple-400" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-white">Informations Légales</h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">SIRET</label>
                                            <input
                                                {...register("siret")}
                                                className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">RCS</label>
                                            <input
                                                {...register("rcs")}
                                                className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">TVA Intracommunautaire</label>
                                        <input
                                            {...register("tvaIntracom")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Mentions légales (Pied de page)</label>
                                        <textarea
                                            {...register("mentionsLegales")}
                                            rows={3}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Informations Bancaires */}
                            <div className="glass-card p-6 rounded-2xl space-y-6">
                                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                                    <div className="p-2 rounded-lg bg-green-500/10">
                                        <CreditCard className="h-5 w-5 text-green-400" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-white">Coordonnées Bancaires</h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Nom de la banque</label>
                                            <input
                                                {...register("banque")}
                                                className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                                placeholder="Ma Banque"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Titulaire du compte</label>
                                            <input
                                                {...register("titulaireCompte")}
                                                className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                                placeholder="Nom du titulaire"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">IBAN</label>
                                        <input
                                            {...register("iban")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono"
                                            placeholder="FR76..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">BIC/SWIFT</label>
                                        <input
                                            {...register("bic")}
                                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        );
    }

    // Placeholder Views for Advanced
    if (activeView === "ADVANCED") {
        const title = "Fonctionnalités avancées";
        return (
            <div className="max-w-3xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setActiveView("MAIN")}
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Réglages
                    </button>
                </div>

                <div className="text-center py-20 glass-card rounded-2xl">
                    <div className="p-4 rounded-full bg-white/5 inline-flex mb-4">
                        <Layers className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
                    <p className="text-muted-foreground">Cette section est en cours de développement.</p>
                </div>
            </div>
        );
    }

    return null;
}

function CreateSocieteView({ onBack }: { onBack: () => void }) {
    const { refreshData } = useData();
    const [isLoading, setIsLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]); // Using any to avoid circle deps for now, ideally User[]
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

    // Form state
    const { register, handleSubmit, formState: { errors } } = useForm<Societe>();

    useEffect(() => {
        // Load users for selection
        setUsers(dataService.getUsers());
        // Select current user by default
        const currentUser = dataService.getCurrentUser();
        if (currentUser) {
            setSelectedUsers([currentUser.id]);
        }
    }, []);

    const toggleUser = (userId: string) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    const onSubmit = async (data: Societe) => {
        setIsLoading(true);
        try {
            // 1. Create the base society
            const newSociete = dataService.createSociete(data.nom);

            // 2. Update with full details
            const updatedSociete = {
                ...newSociete,
                ...data,
                id: newSociete.id // Ensure ID persists
            };
            dataService.updateSociete(updatedSociete);

            // 3. Grant access to selected users
            const allUsers = dataService.getUsers();
            for (const userId of selectedUsers) {
                const user = allUsers.find(u => u.id === userId);
                if (user) {
                    if (!user.societes.includes(newSociete.id)) {
                        user.societes.push(newSociete.id);
                        dataService.saveUser(user);
                    }
                }
            }

            // 4. Force refresh and switch
            refreshData();
            dataService.switchSociete(newSociete.id);

            // 5. Navigate back to main settings (which will now show the NEW society context)
            // We use window.location.reload() or explicit update to ensure full context switch safety?
            // Actually switchSociete does the heavy lifting.
            onBack();

        } catch (error) {
            console.error("Failed to create company", error);
            alert("Erreur lors de la création de la société");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                >
                    <ChevronLeft className="h-5 w-5" />
                    Annuler
                </button>
                <button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-medium rounded-lg shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" />
                    {isLoading ? "Création..." : "Créer la société"}
                </button>
            </div>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Nouvelle Société</h1>
                <p className="text-muted-foreground mt-1">Configurez votre nouvelle entité et attribuez les accès.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                {/* Left Column: Information */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card p-6 rounded-2xl space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                <Building className="h-5 w-5 text-indigo-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-white">Informations Générales</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Nom de l'entreprise *</label>
                                <input
                                    {...register("nom", { required: true })}
                                    className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                    placeholder="Ex: Ma Nouvelle Boite"
                                />
                                {errors.nom && <span className="text-red-500 text-xs ml-1">Ce champ est requis</span>}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Forme juridique</label>
                                <input {...register("formeJuridique")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" placeholder="SAS, SARL..." />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Ville</label>
                                <input {...register("ville")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Adresse</label>
                                <textarea {...register("adresse")} rows={2} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                        </div>

                        {/* Contact & Logo */}
                        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Logo URL</label>
                                <input {...register("logoUrl")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Email Contact</label>
                                <input {...register("email")} type="email" className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Téléphone</label>
                                <input {...register("telephone")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Site Web</label>
                                <input {...register("siteWeb")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <CreditCard className="h-5 w-5 text-green-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-white">Banque & Juridique</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Juridique */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">SIRET</label>
                                <input {...register("siret")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">RCS</label>
                                <input {...register("rcs")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">TVA Intracom</label>
                                <input {...register("tvaIntracom")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Capital Social</label>
                                <input {...register("capitalSocial")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" placeholder="Ex: 1000 €" />
                            </div>

                            {/* Banque */}
                            <div className="col-span-2 border-t border-white/10 pt-4 mt-2">
                                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Coordonnées Bancaires</h3>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Nom de la Banque</label>
                                <input {...register("banque")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Titulaire du compte</label>
                                <input {...register("titulaireCompte")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">IBAN</label>
                                <input {...register("iban")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">BIC (SWIFT)</label>
                                <input {...register("bic")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm font-mono" />
                            </div>

                            {/* Footer defaults */}
                            <div className="col-span-2 border-t border-white/10 pt-4 mt-2">
                                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Mentions légales (Pied de page)</h3>
                            </div>
                            <div className="col-span-2">
                                <textarea
                                    {...register("mentionsLegales")}
                                    rows={3}
                                    className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                                    placeholder="Mentions apparaissant en bas des factures..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Users */}
                <div className="space-y-6">
                    <div className="glass-card p-6 rounded-2xl space-y-6 sticky top-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <Users className="h-5 w-5 text-purple-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-white">Accès Utilisateurs</h2>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Sélectionnez les utilisateurs qui pourront accéder à cette société.
                        </p>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {users.map(u => (
                                <div
                                    key={u.id}
                                    onClick={() => toggleUser(u.id)}
                                    className={cn(
                                        "flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 group",
                                        selectedUsers.includes(u.id)
                                            ? "bg-purple-500/20 border-purple-500/50"
                                            : "glass-card border-white/5 hover:bg-white/5"
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded-md border flex items-center justify-center mr-3 transition-colors",
                                        selectedUsers.includes(u.id)
                                            ? "bg-purple-500 border-purple-500"
                                            : "border-muted-foreground gp-hover:border-white"
                                    )}>
                                        {selectedUsers.includes(u.id) && <Check className="h-3 w-3 text-white" />}
                                    </div>

                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-foreground text-sm truncate">{u.fullName}</span>
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/5 px-1.5 rounded">{u.role}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
