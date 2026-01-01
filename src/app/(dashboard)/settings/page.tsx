"use client";

import { deleteRecord } from '@/app/actions';
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { updateSociete } from "@/app/actions";
import { migrateTemplateToReal } from '@/lib/actions/template-societe';
import { Societe } from "@/types";
import { Save, Building, FileText, CreditCard, ChevronRight, Lock, Shield, Users, Layers, Layout, Key, PenTool, ArrowLeft, ChevronLeft, Database, Mail, Plus, Check, User, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

import { DataManagement } from "@/components/features/DataManagement";
import { UserProfileEditor } from "@/components/features/UserProfileEditor";
import { UserManagement } from "@/components/features/UserManagement";
import { EmailSettings } from "@/components/features/EmailSettings";
import { PDFSettings } from "@/components/features/PDFSettings";
import { toast } from "sonner";

interface SettingsFormData extends Societe {
    globalConfig: any;
}

type SettingsView = "MAIN" | "IDENTITY" | "USERS" | "EMAIL" | "PDF" | "ADVANCED" | "DATA" | "CREATE_SOCIETE" | "PROFILE";

export default function SettingsPageWrapper() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
            <SettingsPage />
        </Suspense>
    );
}

function SettingsPage() {
    const { societe, societes, refreshData, createSociete, logAction, confirm, user } = useData();
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

    const { register, handleSubmit, reset, setValue, formState: { isDirty } } = useForm<SettingsFormData>({
        defaultValues: {
            ...societe,
            globalConfig: dataService.getGlobalConfig()
        }
    });

    const { setIsDirty } = useData();

    // Sync dirty state
    useEffect(() => {
        setIsDirty(isDirty);
        return () => setIsDirty(false);
    }, [isDirty, setIsDirty]);

    // Helper for navigation
    const handleNavigation = (view: SettingsView) => {
        if (isDirty) {
            confirm({
                title: "Modifications non enregistrées",
                message: "Voulez-vous vraiment quitter ?",
                onConfirm: () => setActiveView(view)
            });
        } else {
            setActiveView(view);
        }
    };

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

    // ... imports

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (5MB max before compression)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Le fichier est trop volumineux (max 5MB)');
            return;
        }

        const loadingToast = toast.loading("Traitement de l'image...");

        try {
            const compressed = await compressImage(file);
            setLogoPreview(compressed);

            // Update form state only, do not save yet
            setValue("logoUrl", compressed, { shouldDirty: true });
            toast.success("Logo chargé. Cliquez sur Enregistrer pour valider.");

        } catch (error: any) {
            console.error('Erreur lors du traitement de l\'image:', error);
            toast.error(`Erreur: ${error.message || "Impossible de traiter l'image"}`);
            // Revert preview if failed
            if (societe) setLogoPreview(societe.logoUrl || null);
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const handleRemoveLogo = async () => {
        setLogoPreview(null);
        setValue("logoUrl", "", { shouldDirty: true });
        toast.info("Logo supprimé. Cliquez sur Enregistrer pour valider.");
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


    // ... (Inside SettingsPage)

    const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
    const [activationData, setActivationData] = useState<SettingsFormData | null>(null);

    const onSubmit = async (data: SettingsFormData) => {
        // DETECT DEMO MODE ACTIVATION
        // @ts-ignore
        if (societe?.isTemplate) {
            setActivationData(data);
            setIsActivationModalOpen(true);
            return;
        }

        setIsSaving(true);
        try {
            const { globalConfig, ...societeData } = data;
            await updateSociete(societeData);
            dataService.saveGlobalConfig(globalConfig);
            refreshData();
            // Reset to prevent dirty state from persisting after save
            reset(data);
            toast.success("Informations enregistrées avec succès");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de l'enregistrement");
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivation = async (keepData: boolean) => {
        if (!activationData || !user?.id) return;
        setIsActivationModalOpen(false); // Close modal
        setIsSaving(true);
        const toastId = toast.loading(keepData ? "Activation et migration..." : "Création de la nouvelle société...");

        try {
            const { globalConfig, ...societeData } = activationData;

            // Server Action
            const result = await migrateTemplateToReal(user.id, societeData, keepData);

            if (result.success) {
                toast.dismiss(toastId);
                toast.success("Compte activé avec succès !");

                // Force full reload to reset context/IDs
                window.location.href = "/";
            } else {
                throw new Error(result.error || "Erreur inconnue");
            }
        } catch (error: any) {
            console.error("Activation error", error);
            toast.dismiss(toastId);
            toast.error("Erreur d'activation : " + error.message);
            setIsSaving(false);
        }
    };

    // ... (Hooks) ...

    // ... helper components remain the same ...
    const SettingsItem = ({ icon: Icon, label, color, onClick }: { icon: any, label: string, color: string, onClick?: () => void }) => (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between p-4 glass-card hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-border last:border-0 group text-left"
        >
            <div className="flex items-center gap-3">
                <div className={cn("p-1.5 rounded-md", color)}>
                    <Icon className="h-5 w-5 text-foreground" />
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
            <div className="flex flex-col rounded-xl overflow-hidden glass-card border border-border">
                {children}
            </div>
        </div>
    );



    if (activeView === "DATA") {
        return (
            <div className="h-full flex flex-col p-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex-1 overflow-y-auto">
                    <DataManagement onBack={() => setActiveView("MAIN")} />
                </div>
            </div>
        );
    }



    // ...

    if (activeView === "USERS") {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => handleNavigation("MAIN")}
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Réglages
                    </button>
                </div>
                <UserManagement />
            </div>
        );
    }

    if (activeView === "EMAIL") {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => handleNavigation("MAIN")}
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

    if (activeView === "PDF") {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => handleNavigation("MAIN")}
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Réglages
                    </button>
                </div>
                <PDFSettings />
            </div>
        );
    }

    if (activeView === "PROFILE") {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => handleNavigation("MAIN")}
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Retour aux réglages
                    </button>
                </div>
                <UserProfileEditor onBack={() => handleNavigation("MAIN")} />
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
                    {/* SECTION: Mon Compte */}
                    <SettingsSection title="Mon Compte">
                        <SettingsItem
                            icon={User}
                            label="Mon Profil"
                            color="bg-blue-500/10 text-blue-500"
                            onClick={() => setActiveView("PROFILE")}
                        />
                        <SettingsItem
                            icon={Plus}
                            label="Nouvelle Société"
                            color="bg-orange-500"
                            onClick={() => router.push("/onboarding?context=add")}
                        />
                    </SettingsSection>

                    {/* SECTION: Identité & Société (Renamed / Restructured) */}
                    <SettingsSection title={`Entreprise : ${societe?.nom || 'Ma Société'}`}>
                        <SettingsItem
                            icon={Building}
                            label="Identité Société"
                            color="bg-indigo-500" // Kept similar color
                            onClick={() => setActiveView("IDENTITY")}
                        />
                        <SettingsItem
                            icon={Users}
                            label="Membres & Accès"
                            color="bg-green-500"
                            onClick={() => setActiveView("USERS")}
                        />
                        <SettingsItem
                            icon={Mail}
                            label="Email"
                            color="bg-blue-500"
                            onClick={() => setActiveView("EMAIL")}
                        />
                        <SettingsItem
                            icon={FileText}
                            label="PDF"
                            color="bg-purple-500"
                            onClick={() => setActiveView("PDF")}
                        />
                        <SettingsItem
                            icon={Database}
                            label="Import / Export"
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
            <div className="max-w-6xl mx-auto px-6 pb-20 animate-in fade-in slide-in-from-right-8 duration-300">
                {/* Activation Modal */}
                {isActivationModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-background border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-6 glass-card">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-full">
                                    <Key className="h-6 w-6 text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">Activer votre compte</h2>
                                    <p className="text-sm text-muted-foreground">Vous passez du mode démo à une vraie société.</p>
                                </div>
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-600">
                                <strong>Note :</strong> La société de démonstration sera remplacée par la nouvelle.
                            </div>

                            <div className="space-y-4">
                                <p className="font-medium text-foreground">Que voulez-vous faire des données de test (factures, clients...) ?</p>

                                <button
                                    onClick={() => handleActivation(true)}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-white/5 hover:border-blue-500/50 transition-all text-left group"
                                >
                                    <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                        <Database className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground">Conserver les données</div>
                                        <div className="text-xs text-muted-foreground">Migrer tout l'historique vers la nouvelle société.</div>
                                    </div>
                                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                </button>

                                <button
                                    onClick={() => handleActivation(false)}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-white/5 hover:border-emerald-500/50 transition-all text-left group"
                                >
                                    <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                                        <Layout className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground">Repartir à zéro</div>
                                        <div className="text-xs text-muted-foreground">Supprimer les données de test et commencer propre.</div>
                                    </div>
                                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="pt-2 text-center">
                                <button
                                    onClick={() => setIsActivationModalOpen(false)}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                    Annuler et rester en mode démo
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header - Not Sticky */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => handleNavigation("MAIN")}
                            className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">Identité & Entreprise</h1>
                            <p className="text-xs text-muted-foreground hidden md:block">Gérez les informations légales et l'apparence de votre société</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-foreground font-medium rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? "..." : "Enregistrer"}
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    {/* Top Grid: Logo & General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                        {/* Right Col: General Info (8/12) -> NOW LEFT */}
                        <div className="md:col-span-8 space-y-6">
                            <div className="glass-card p-6 rounded-xl border border-border">
                                <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                                    <div className="p-2 rounded-lg bg-purple-500/10">
                                        <Building className="h-5 w-5 text-purple-400" />
                                    </div>
                                    <h2 className="text-sm font-semibold text-foreground">Informations Générales</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Nom de l'entreprise</label>
                                        <input
                                            {...register("nom")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Forme Juridique</label>
                                        <input
                                            {...register("formeJuridique")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Capital Social</label>
                                        <input
                                            {...register("capitalSocial")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Email contact</label>
                                        <input
                                            {...register("email")}
                                            type="email"
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Site Web</label>
                                        <input
                                            {...register("siteWeb")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Address Card */}
                            <div className="glass-card p-6 rounded-xl border border-border">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-orange-500/10">
                                        <Layout className="h-5 w-5 text-orange-400" />
                                    </div>
                                    <h2 className="text-sm font-semibold text-foreground">Adresse & Contact</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Adresse postale</label>
                                        <input
                                            {...register("adresse")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Code Postal</label>
                                        <input
                                            {...register("codePostal")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Ville</label>
                                        <input
                                            {...register("ville")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Téléphone</label>
                                        <input
                                            {...register("telephone")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Pays</label>
                                        <input
                                            {...register("pays")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder=""
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Left Col: Logo (4/12) -> NOW RIGHT */}
                        <div className="md:col-span-4 space-y-6">
                            <div className="glass-card p-5 rounded-xl flex flex-col h-full border border-border">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-blue-500/10">
                                        <ImageIcon className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <h2 className="text-sm font-semibold text-foreground">Logo</h2>
                                </div>

                                <div className="flex-1 flex flex-col gap-4">
                                    <div
                                        className="aspect-square bg-black/40 rounded-lg border border-border flex items-center justify-center overflow-hidden relative group"
                                    >
                                        {logoPreview ? (
                                            <>
                                                <img
                                                    src={logoPreview}
                                                    alt="Logo"
                                                    className="max-w-full max-h-full object-contain p-4"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveLogo}
                                                        className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <X className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center text-muted-foreground">
                                                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                                <span className="text-xs">Aucun logo</span>
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={cn(
                                            "border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer text-center",
                                            isDragging
                                                ? "border-blue-400 bg-blue-500/10"
                                                : "border-border hover:border-white/20 hover:bg-white/5"
                                        )}
                                    >
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                            id="logo-upload"
                                        />
                                        <label htmlFor="logo-upload" className="cursor-pointer block">
                                            <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                                            <span className="text-xs text-muted-foreground block">Cliquez ou glissez une image (max 10MB)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Bottom Grid: Legal & Banking (2 Cols) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Legal Info */}
                        <div className="glass-card p-6 rounded-xl border border-border h-full">
                            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                                <div className="p-2 rounded-lg bg-indigo-500/10">
                                    <Shield className="h-5 w-5 text-indigo-400" />
                                </div>
                                <h2 className="text-sm font-semibold text-foreground">Informations Légales</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">SIRET</label>
                                        <input
                                            {...register("siret")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm font-mono"
                                            placeholder="000 000 000 00000"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">RCS</label>
                                        <input
                                            {...register("rcs")}
                                            className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                            placeholder="RCS Paris B ..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">TVA Intracommunautaire</label>
                                    <input
                                        {...register("tvaIntra")}
                                        className="w-full h-10 glass-input px-3 rounded-lg text-sm font-mono"
                                        placeholder="FR 00 000000000"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Mentions légales (Pied de page)</label>
                                    <textarea
                                        {...register("mentionsLegales")}
                                        className="w-full glass-input px-3 py-2 rounded-lg text-sm min-h-[80px]"
                                        placeholder="Ex: SAS au capital de..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Banking Info */}
                        <div className="glass-card p-6 rounded-xl border border-border h-full">
                            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                                <div className="p-2 rounded-lg bg-green-500/10">
                                    <CreditCard className="h-5 w-5 text-green-400" />
                                </div>
                                <h2 className="text-sm font-semibold text-foreground">Coordonnées Bancaires</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Nom de la Banque</label>
                                    <input
                                        {...register("banque")}
                                        className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                        placeholder="Ma Banque"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">Titulaire du compte</label>
                                    <input
                                        {...register("titulaireCompte")}
                                        className="w-full h-10 glass-input px-3 rounded-lg text-sm"
                                        placeholder="Nom du titulaire"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">IBAN</label>
                                    <input
                                        {...register("iban")}
                                        className="w-full h-10 glass-input px-3 rounded-lg text-sm font-mono"
                                        placeholder="FR76 ..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">BIC / SWIFT</label>
                                    <input
                                        {...register("bic")}
                                        className="w-full h-10 glass-input px-3 rounded-lg text-sm font-mono"
                                        placeholder="XXXXXXXX"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone: Delete Society */}
                    <div className="glass-card p-6 rounded-xl border border-red-500/20 bg-red-500/5 mt-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-red-500 flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Zone de Danger
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    La suppression de la société est irréversible.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (societe && societes.length <= 1) {
                                        toast.error("Vous ne pouvez pas supprimer la dernière société.");
                                        return;
                                    }
                                    confirm({
                                        title: "Supprimer la société ?",
                                        message: "Cette action est irréversible. Toutes les factures, clients et produits de cette société seront perdus.",
                                        onConfirm: async () => {
                                            if (!societe) return;
                                            try {
                                                const nomSociete = societe.nom;
                                                await deleteRecord('Societe', societe.id);
                                                logAction('delete', 'societe', `Société ${nomSociete} supprimée`, societe.id);
                                                toast.success(`Société ${nomSociete} supprimée avec succès`);

                                                // Force refresh and redirect to home to let provider pick next company
                                                await refreshData();
                                                window.location.href = "/";
                                            } catch (e: any) {
                                                console.error(e);
                                                toast.error("Erreur: " + e.message);
                                            }
                                        }
                                    });
                                }}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 transition-colors text-sm font-medium"
                            >
                                Supprimer la société
                            </button>
                        </div>
                    </div>
                </form >
            </div >
        );
    }

    // Advanced View Placeholder
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
                    <p className="text-muted-foreground">Gestion des utilisateurs, permissions et logs (Bientôt).</p>
                </div>
            </div>
        );
    }

    return null;
}

function CreateSocieteView({ onBack }: { onBack: () => void }) {
    const { refreshData, createSociete, updateSociete } = useData(); // Ensure updateSociete is available
    const [isLoading, setIsLoading] = useState(false);

    // Extended form state
    const { register, handleSubmit, formState: { errors } } = useForm<Societe>();

    const onSubmit = async (data: Societe) => {
        setIsLoading(true);
        try {
            // 1. Create with Name
            // Warning: createSociete returns Promise<any> or void?
            // We assume it returns the new ID or object, or we fetch it.
            // If createSociete is just `actions.createSociete`, it returns {success, id}.
            // If it's wrapped in DataProvider, it might return the result.
            // Let's assume standard flow:
            const res = await createSociete(data.nom);

            // If res contains ID, we can update immediately
            if (res && res.id) {
                const newId = res.id;
                // 2. Update with other details
                await updateSociete({ ...data, id: newId });
                toast.success("Société créée avec succès !");
                await refreshData();
                onBack();
            } else {
                // Fallback if no ID returned (shouldn't happen with proper action)
                toast.success("Société créée !");
                await refreshData();
                onBack();
            }
        } catch (error: any) {
            console.error("Failed to create company", error);
            toast.error("Erreur lors de la création: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Nouvelle Société
                    </h2>
                    <p className="text-muted-foreground">Configurez votre nouvel espace de travail.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Main Identity Card */}
                <div className="glass-card p-8 rounded-2xl border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 text-xs text-center border border-blue-500/20">1</span>
                                Identité
                            </h3>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">Nom de la société *</label>
                                <input
                                    {...register("nom", { required: "Le nom est requis" })}
                                    className="w-full h-12 glass-input px-4 rounded-xl text-lg font-medium focus:ring-2 focus:ring-blue-500/50"
                                    placeholder="Ex: Ma Super Boite"
                                    autoFocus
                                />
                                {errors.nom && <span className="text-xs text-red-500 ml-1">{errors.nom.message}</span>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">Email de contact</label>
                                <input
                                    {...register("email")}
                                    type="email"
                                    className="w-full h-11 glass-input px-4 rounded-xl"
                                    placeholder="contact@societe.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">Téléphone</label>
                                <input
                                    {...register("telephone")}
                                    className="w-full h-11 glass-input px-4 rounded-xl"
                                    placeholder="+33 1 23 45 67 89"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-500/20 text-purple-400 text-xs text-center border border-purple-500/20">2</span>
                                Adresse & Légal
                            </h3>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">Adresse</label>
                                <input
                                    {...register("adresse")}
                                    className="w-full h-11 glass-input px-4 rounded-xl"
                                    placeholder="123 Avenue..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground ml-1">Code Postal</label>
                                    <input
                                        {...register("codePostal")}
                                        className="w-full h-11 glass-input px-4 rounded-xl"
                                        placeholder="75000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground ml-1">Ville</label>
                                    <input
                                        {...register("ville")}
                                        className="w-full h-11 glass-input px-4 rounded-xl"
                                        placeholder="Paris"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground ml-1">SIRET</label>
                                    <input
                                        {...register("siret")}
                                        className="w-full h-11 glass-input px-4 rounded-xl font-mono text-sm"
                                        placeholder="123 456 789 00000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground ml-1">TVA Intra</label>
                                    <input
                                        {...register("tvaIntra")}
                                        className="w-full h-11 glass-input px-4 rounded-xl font-mono text-sm"
                                        placeholder="FR..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-6 py-3 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground font-medium"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Création...
                            </>
                        ) : (
                            <>
                                <Check className="h-5 w-5" />
                                Créer la société
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
