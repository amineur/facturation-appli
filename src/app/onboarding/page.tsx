'use client';

import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useData } from '@/components/data-provider';
import { useState } from 'react';

export default function OnboardingPage() {
    const router = useRouter();
    const { createSociete, isLoading } = useData();
    const [companyName, setCompanyName] = useState("");

    const handleCreate = async () => {
        if (!companyName.trim()) {
            toast.error("Veuillez saisir un nom de société");
            return;
        }

        const result = await createSociete(companyName.trim());
        if (result) {
            toast.success(`Société "${companyName}" créée avec succès !`);
            // Redirection handled by createSociete in data-provider (line 373 -> /settings)
        } else {
            toast.error("Erreur lors de la création de la société");
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,60,255,0.1),rgba(0,0,0,0))]" />

            <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative z-10">
                <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                    <Building2 className="h-8 w-8 text-blue-400" />
                </div>

                <h1 className="text-2xl font-bold mb-2 text-center">Bienvenue !</h1>
                <p className="text-muted-foreground mb-8 text-center">
                    Créez votre première société pour commencer à gérer vos factures et devis.
                </p>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Nom de votre société</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            placeholder="Ex: Ma Société SARL"
                            className="w-full glass-input px-4 py-3 rounded-xl text-white"
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={isLoading || !companyName.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Création en cours...
                            </>
                        ) : (
                            <>
                                Créer ma société
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => toast.info("Contactez votre administrateur pour obtenir une invitation.")}
                        disabled={isLoading}
                        className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-all"
                    >
                        Demander l'accès à une société existante
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                                window.localStorage.clear();
                                router.push('/login');
                            });
                        }}
                        disabled={isLoading}
                        className="text-xs text-muted-foreground hover:text-white underline"
                    >
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
}
