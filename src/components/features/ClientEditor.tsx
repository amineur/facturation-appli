"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { User, Mail, Phone, MapPin, Save, ArrowLeft, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
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
    // adresse2 removed
    codePostal: string;
    ville: string;
    pays: string;
    prenomContact: string;
    nomContact: string;
}

export function ClientEditor({ initialData }: { initialData?: Client }) {
    const { refreshData, societe } = useData();
    const router = useRouter();
    const [countryOpen, setCountryOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState(initialData?.pays || "France");
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { register, handleSubmit, setValue, formState: { errors } } = useForm<ClientFormValues>({
        defaultValues: {
            nom: initialData?.nom || "",
            siret: initialData?.siret || "",
            tvaIntra: initialData?.tvaIntra || "",
            email: initialData?.email || "",
            telephone: initialData?.telephone || "",
            mobile: initialData?.mobile || "",
            adresse: initialData?.adresse || "",
            // adresse2 removed
            codePostal: initialData?.codePostal || "",
            ville: initialData?.ville || "",
            pays: initialData?.pays || "France",
            prenomContact: initialData?.prenomContact || "",
            nomContact: initialData?.nomContact || ""
        }
    });

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

    // Filter countries
    const filteredCountries = COUNTRIES.filter(c =>
        c.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const onSubmit = (data: ClientFormValues) => {
        const clientData: Client = {
            id: initialData?.id || crypto.randomUUID(),
            societeId: societe.id,
            ...data,
            adresse2: "", // Clear or keep empty
            pays: countrySearch // Ensure we take the state value if manually typed
        };

        dataService.saveClient(clientData);
        refreshData();
        alert("Client enregistré avec succès !");
        router.push("/clients");
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/clients" className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">{initialData ? "Modifier le Client" : "Nouveau Client"}</h2>
                        <p className="text-muted-foreground mt-1">Saisissez les informations du client.</p>
                    </div>
                </div>
                <button type="submit" className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20">
                    <Save className="h-4 w-4" />
                    Enregistrer
                </button>
            </div>

            <div className="glass-card rounded-xl p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Identity */}
                    <div className="space-y-4 md:col-span-2">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-500" /> Identité
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-muted-foreground">Nom / Raison Sociale</label>
                            <input
                                {...register("nom", { required: "Le nom est requis" })}
                                className="w-full h-11 rounded-lg glass-input px-4 text-foreground focus:ring-2 focus:ring-blue-500/50 transition-all"
                                placeholder="Ex: Acme Corp"
                            />
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

                    {/* Contact */}
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

                    {/* Address */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-orange-500" /> Adresse
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Adresse complète (Ligne 1)</label>
                                <input {...register("adresse")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" placeholder="123 Rue..." />
                            </div>
                            {/* Adresse 2 Removed */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Code Postal</label>
                                    <input {...register("codePostal")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Ville</label>
                                    <input {...register("ville")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" />
                                </div>
                            </div>

                            {/* Custom Country Combobox */}
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
                                    <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-white/20 bg-[#1a1a1a] shadow-xl">
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
