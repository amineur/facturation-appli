'use client';

import { Building2, ArrowRight, Loader2, Search, MapPin, CreditCard, Image as ImageIcon, ChevronLeft, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useData } from '@/components/data-provider';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
    const router = useRouter();
    const { createSociete, isLoading: isGlobalLoading, societes } = useData();

    // --- STATE ---
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false); // Local loading state for API calls

    // Form Data
    const [formData, setFormData] = useState({
        // Identity
        nom: "",
        adresse: "",
        codePostal: "",
        ville: "",
        pays: "France",
        siret: "",
        siren: "",
        tvaIntra: "",
        formeJuridique: "",
        rcs: "",
        email: "",
        telephone: "",
        siteWeb: "",

        // Banking
        banque: "",
        iban: "",
        bic: "",
        titulaireCompte: "",

        // Branding
        logoUrl: "",
        primaryColor: "#3b82f6",
    });

    // Search State (Step 1)
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<any>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    // --- EFFECTS ---

    // Debounced Company Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 3 && !selectedCompany) {
                setIsSearching(true);
                try {
                    const response = await fetch(`/api/company-search?q=${encodeURIComponent(searchTerm)}`);
                    const data = await response.json();
                    if (data.success) {
                        setSearchResults(data.results);
                        setShowResults(true);
                    } else {
                        setSearchResults([]);
                    }
                } catch (error) {
                    console.error("Search error:", error);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
                setShowResults(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedCompany]);

    // IBAN Auto-lookup
    const handleIbanChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Keep spaces removed for logic, add formatting later if needed
        setFormData(prev => ({ ...prev, iban: val }));

        if (val.length >= 14 && val.startsWith('FR')) {
            // lookup
            try {
                const res = await fetch(`/api/iban-lookup?iban=${val}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setFormData(prev => ({
                        ...prev,
                        banque: data.data.bankName || prev.banque,
                        bic: data.data.bic || prev.bic,
                    }));
                    if (data.source !== 'local') {
                        toast.success(`Banque détectée : ${data.data.bankName}`);
                    }
                }
            } catch (err) {
                // silent
            }
        }
    };

    // Close search results on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- HANDLERS ---

    const handleSelectCompany = (company: any) => {
        setSelectedCompany(company);
        setSearchTerm(company.nom || "");
        setShowResults(false);

        // Auto-fill form data with fallbacks to avoid uncontrolled input warning
        setFormData(prev => ({
            ...prev,
            nom: company.nom || "",
            adresse: company.adresse || "",
            codePostal: company.codePostal || "",
            ville: company.ville || "",
            siret: company.siret || "",
            siren: company.siren || "",
            tvaIntra: company.tvaIntra || "",
            formeJuridique: company.formeJuridique || "",
            rcs: (company.siren && company.ville) ? `RCS ${company.ville} ${company.siren}` : (company.siret ? `RCS ${company.ville || ''} ${company.siret.substring(0, 9)}`.trim() : ""),
            titulaireCompte: company.nom || "",
        }));
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Le fichier est trop volumineux (max 5MB)');
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
        };
    };

    const handleNext = () => {
        if (step === 1 && !formData.nom.trim()) {
            toast.error("Veuillez saisir ou sélectionner un nom de société");
            return;
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const handleFinalCreate = async () => {
        if (isGlobalLoading || isLoading) return;

        setIsLoading(true);
        const result = await createSociete(formData.nom, formData);
        setIsLoading(false);

        if (result) {
            toast.success(`Société "${formData.nom}" créée avec succès !`);
        } else {
            toast.error("Erreur lors de la création de la société");
        }
    };

    // --- RENDER STEPS ---

    const renderStep1_Identity = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2 relative" ref={searchRef}>
                <label className="text-sm font-medium text-muted-foreground">Nom de la société / Recherche SIRET</label>
                <div className="relative">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setFormData(prev => ({ ...prev, nom: e.target.value }));
                            if (selectedCompany && e.target.value !== selectedCompany.nom) {
                                setSelectedCompany(null);
                            }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && !showResults && handleNext()}
                        placeholder="Rechercher (ex: Urbanhit)..."
                        className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                        autoFocus
                    />
                    {isSearching && (
                        <div className="absolute right-3 top-3.5">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        </div>
                    )}
                </div>
                {/* Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                        {searchResults.map((company, index) => (
                            <button
                                key={`${company.siret}-${index}`}
                                onClick={() => handleSelectCompany(company)}
                                className="w-full text-left p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex flex-col gap-0.5 group"
                            >
                                <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                                    {company.nom}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{company.formeJuridique || 'N/A'}</span>
                                    {company.ville && <span>• {company.ville} ({company.codePostal})</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview / Manual Edit of Key Fields */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">SIRET</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.siret || ''}
                        onChange={e => setFormData(p => ({ ...p, siret: e.target.value }))}
                        placeholder="000..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">RCS</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.rcs || ''}
                        onChange={e => setFormData(p => ({ ...p, rcs: e.target.value }))}
                        placeholder="RCS Paris B..."
                    />
                </div>
                <div className="col-span-2 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Adresse complète</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.adresse || ''}
                        onChange={e => setFormData(p => ({ ...p, adresse: e.target.value }))}
                        placeholder="123 Rue..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Code Postal</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.codePostal || ''}
                        onChange={e => setFormData(p => ({ ...p, codePostal: e.target.value }))}
                        placeholder="75001"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Ville</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.ville || ''}
                        onChange={e => setFormData(p => ({ ...p, ville: e.target.value }))}
                        placeholder="Paris"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Email contact</label>
                    <input
                        type="email"
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.email || ''}
                        onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                        placeholder="contact@..."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
                    <input
                        type="tel"
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.telephone || ''}
                        onChange={e => setFormData(p => ({ ...p, telephone: e.target.value }))}
                        placeholder="01..."
                    />
                </div>
            </div>
        </div>
    );

    const renderStep2_Banking = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">IBAN (Détection auto banque)</label>
                <div className="relative">
                    <CreditCard className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                        className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-white font-mono"
                        value={formData.iban}
                        onChange={handleIbanChange}
                        placeholder="FR76..."
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">BIC</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm font-mono"
                        value={formData.bic}
                        onChange={e => setFormData(p => ({ ...p, bic: e.target.value }))}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Nom Banque</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.banque}
                        onChange={e => setFormData(p => ({ ...p, banque: e.target.value }))}
                    />
                </div>
                <div className="col-span-2 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Titulaire du compte</label>
                    <input
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                        value={formData.titulaireCompte || ''}
                        onChange={e => setFormData(p => ({ ...p, titulaireCompte: e.target.value }))}
                        placeholder="Nom du titulaire"
                    />
                </div>
            </div>
        </div>
    );

    const renderStep3_Branding = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Logo de la société</label>
                <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative group">
                        {formData.logoUrl ? (
                            <>
                                <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                                <button
                                    onClick={() => setFormData(p => ({ ...p, logoUrl: "" }))}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </>
                        ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors">
                            <Upload className="h-4 w-4" />
                            Choisir un fichier
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </label>
                        <p className="text-xs text-muted-foreground mt-2">Recommandé: PNG transparent, max 5MB.</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,60,255,0.1),rgba(0,0,0,0))]" />

            <div className="max-w-xl w-full glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative z-10 transition-all duration-500">
                {/* Header with Steps */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                            <Building2 className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">
                                {societes && societes.length > 0 ? "Ajouter une société" : "Créer votre société"}
                            </h1>
                            <p className="text-xs text-muted-foreground">Étape {step} sur 3</p>
                        </div>
                    </div>
                    {/* Steps Indicator */}
                    <div className="flex gap-1.5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300",
                                i === step ? "w-6 bg-blue-500" : i < step ? "w-1.5 bg-blue-500/50" : "w-1.5 bg-white/10")}
                            />
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <div className="min-h-[300px]">
                    {step === 1 && renderStep1_Identity()}
                    {step === 2 && renderStep2_Banking()}
                    {step === 3 && renderStep3_Branding()}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-white/10">
                    {step > 1 ? (
                        <button
                            onClick={handleBack}
                            className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                                    window.localStorage.clear();
                                    router.push('/login');
                                });
                            }}
                            className="text-xs text-muted-foreground hover:text-white underline mr-auto px-2"
                        >
                            Annuler
                        </button>
                    )}

                    <button
                        onClick={step === 3 ? handleFinalCreate : handleNext}
                        disabled={isLoading || isGlobalLoading || (step === 1 && !formData.nom)}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        {isLoading || isGlobalLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {step === 3 ? "Création..." : "Chargement..."}
                            </>
                        ) : (
                            <>
                                {step === 3 ? "Créer la société" : "Continuer"}
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
