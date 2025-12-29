"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { User, Mail, Phone, MapPin, Save, ArrowLeft, ChevronDown, Loader2, Check, AlertTriangle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { createClientAction, updateClientAction as updateClient } from "@/app/actions-clients";
import { Client } from "@/types";
import { COUNTRIES } from "@/lib/countries";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ClientFormValues {
    nom: string;
    siret: string;
    tvaIntra: string;
    email: string;
    telephone: string;
    mobile: string;
    adresse: string;
    codePostal: string;
    ville: string;
    pays: string;
    prenomContact: string;
    nomContact: string;
}

export function ClientEditor({ initialData, onSuccess, onCancel }: { initialData?: Client, onSuccess?: (client: Client) => void, onCancel?: () => void }) {
    const { refreshData, societe, setIsDirty, confirm, logAction, clients } = useData();
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get("returnUrl");

    const [countryOpen, setCountryOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState(initialData?.pays || "France");
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<ClientFormValues>({
        defaultValues: {
            nom: initialData?.nom || "",
            siret: initialData?.siret || "",
            tvaIntra: initialData?.tvaIntra || "",
            email: initialData?.email || "",
            telephone: initialData?.telephone || "",
            mobile: initialData?.mobile || "",
            adresse: initialData?.adresse || "",
            codePostal: initialData?.codePostal || "",
            ville: initialData?.ville || "",
            pays: initialData?.pays || "France",
            prenomContact: initialData?.prenomContact || "",
            nomContact: initialData?.nomContact || ""
        }
    });

    // Auto-fill City based on Zip Code (France only)
    const watchedZip = watch("codePostal");
    const watchedName = watch("nom");

    // Check for duplicates
    const duplicateClient = clients.find(c =>
        c.nom.trim().toLowerCase() === watchedName?.trim().toLowerCase() &&
        c.id !== initialData?.id
    );

    useEffect(() => {
        const fetchCity = async () => {
            if (watchedZip && watchedZip.length === 5 && !isNaN(Number(watchedZip))) {
                try {
                    const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${watchedZip}&fields=nom&format=json&geometry=centre`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.length > 0) {
                            setValue("ville", data[0].nom);
                            setValue("pays", "France");
                            setCountrySearch("France");
                        }
                    }
                } catch (error) {
                    console.error("Error fetching city:", error);
                }
            }
        };

        const timeoutId = setTimeout(fetchCity, 300);
        return () => clearTimeout(timeoutId);
    }, [watchedZip, setValue]);

    // Sync isDirty with global state
    useEffect(() => {
        setIsDirty(isDirty);
        return () => setIsDirty(false);
    }, [isDirty, setIsDirty]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setCountryOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredCountries = COUNTRIES.filter(c =>
        c.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const [isSaving, setIsSaving] = useState(false);

    const onSubmit = async (data: ClientFormValues) => {
        setIsSaving(true);
        try {
            const isNew = !initialData?.id;

            const clientData: Client = {
                id: initialData?.id || "temp",
                societeId: societe?.id || "",
                ...data,
                adresse2: "",
                pays: countrySearch
            };

            if (isNew) {
                const res = await createClientAction(clientData);
                if (!res.success || !res.id) throw new Error(res.error || "Erreur lors de la création");
                clientData.id = res.id;
                logAction('create', 'client', `Nouveau client ${clientData.nom} créé`, clientData.id);
            } else {
                const res = await updateClient(clientData);
                if (!res.success) throw new Error(res.error || "Erreur lors de la modification");
                logAction('update', 'client', `Client ${clientData.nom} modifié`, clientData.id);
            }

            await refreshData();
            toast.success("Client enregistré avec succès !");
            reset(data);

            if (onSuccess) {
                onSuccess(clientData);
                return;
            }

            if (isNew) {
                setTimeout(() => {
                    if (returnUrl) {
                        const separator = returnUrl.includes('?') ? '&' : '?';
                        router.push(`${returnUrl}${separator}clientId=${clientData.id}`);
                    } else {
                        router.push("/clients");
                    }
                }, 500);
            }

        } catch (error: any) {
            console.error(error);
            toast.error("Erreur: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {onCancel ? (
                        <button type="button" onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                if (isDirty) {
                                    confirm({
                                        title: "Modifications non enregistrées",
                                        message: "Voulez-vous vraiment quitter ?",
                                        onConfirm: () => router.push("/clients")
                                    });
                                } else {
                                    router.push("/clients");
                                }
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">{initialData ? "Modifier le Client" : "Nouveau Client"}</h2>
                        <p className="text-muted-foreground mt-1">Saisissez les informations du client.</p>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isSaving || (!!initialData?.id && !isDirty)}
                    className={cn(
                        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 border",
                        (!isSaving && !(!!initialData?.id && !isDirty)) && "bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-md border-transparent shadow-sm",
                        isSaving && "bg-emerald-600 text-white opacity-80 cursor-wait border-transparent",
                        (!!initialData?.id && !isDirty && !isSaving) && "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 shadow-none translate-y-[1px]"
                    )}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enregistrement...
                        </>
                    ) : (!!initialData?.id && !isDirty) ? (
                        <>
                            <Check className="h-4 w-4" />
                            Enregistré
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Enregistrer
                        </>
                    )}
                </button>
            </div>

            <div className="glass-card rounded-xl p-4 md:p-8 space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 md:col-span-2">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-500" /> Identité
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-muted-foreground">Nom / Raison Sociale</label>
                            <div className="space-y-1">
                                <input
                                    {...register("nom", { required: "Le nom est requis" })}
                                    className={cn(
                                        "w-full h-11 rounded-lg glass-input px-4 text-foreground focus:ring-2 focus:ring-blue-500/50 transition-all",
                                        duplicateClient && "border-amber-500/50 focus:ring-amber-500/50"
                                    )}
                                    placeholder="Ex: Acme Corp"
                                />
                                {duplicateClient && (
                                    <div className="flex items-center gap-2 text-amber-500 text-xs animate-in slide-in-from-top-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>Attention : Un client existe déjà avec ce nom</span>
                                    </div>
                                )}
                            </div>
                            {errors.nom && <span className="text-xs text-red-400">{errors.nom.message}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">SIRET</label>
                                <input {...register("siret")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="14 chiffres" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">TVA Intracommunautaire</label>
                                <input {...register("tvaIntra")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="FR..." />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <Mail className="h-4 w-4 text-purple-500" /> Contact
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Prénom Contact</label>
                                    <input {...register("prenomContact")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="Ex: Jean" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Nom Contact</label>
                                    <input {...register("nomContact")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="Ex: Dupont" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Email</label>
                                <input
                                    {...register("email", { required: "L'email est requis" })}
                                    className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                    placeholder="contact@example.com"
                                />
                                {errors.email && <span className="text-xs text-red-400">{errors.email.message}</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Téléphone</label>
                                    <input {...register("telephone")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="Fixe" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Portable</label>
                                    <input {...register("mobile")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="Mobile" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-orange-500" /> Adresse
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Adresse complète (Ligne 1)</label>
                                <input {...register("adresse")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="123 Rue..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Code Postal</label>
                                    <input {...register("codePostal")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="75001" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Ville</label>
                                    <input {...register("ville")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="Paris" />
                                </div>
                            </div>

                            <div className="space-y-2 relative" ref={dropdownRef}>
                                <label className="block text-sm font-medium text-muted-foreground">Pays</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={countrySearch}
                                        onChange={(e) => {
                                            setCountrySearch(e.target.value);
                                            setValue("pays", e.target.value);
                                            setCountryOpen(true);
                                        }}
                                        onFocus={() => setCountryOpen(true)}
                                        className="w-full h-11 rounded-lg glass-input px-4 text-foreground pr-10"
                                        placeholder="Rechercher un pays..."
                                    />
                                    <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                </div>

                                {countryOpen && (
                                    <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg glass-card">
                                        {filteredCountries.length > 0 ? (
                                            filteredCountries.map((country) => (
                                                <button
                                                    key={country}
                                                    type="button"
                                                    onClick={() => {
                                                        setCountrySearch(country);
                                                        setValue("pays", country);
                                                        setCountryOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/10 transition-colors"
                                                >
                                                    {country}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-sm text-muted-foreground text-center">
                                                Aucun pays trouvé
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
