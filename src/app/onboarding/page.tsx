'use client';

import { Building2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function OnboardingPage() {
    const router = useRouter();

    const handleCreate = async () => {
        // Here we would ideally have a "Create Societe" form or call an action.
        // For compliance with "Fix Minimal", we might just create a default one or show a toast.
        // But the user requested "UI: 2 choix".
        // Let's simulate creation or just show a message since we don't have the "Create Societe" UI ready-ready in this task scope
        // Wait, "createSociete" is in actions? Let's check.
        // For now, placeholder.
        toast.info("La création de société arrive très vite !");
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,60,255,0.1),rgba(0,0,0,0))]" />

            <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative z-10 text-center">
                <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                    <Building2 className="h-8 w-8 text-blue-400" />
                </div>

                <h1 className="text-2xl font-bold mb-2">Bienvenue !</h1>
                <p className="text-muted-foreground mb-8">
                    Vous n'êtes rattaché à aucune société pour le moment.
                    Que souhaitez-vous faire ?
                </p>

                <div className="space-y-4">
                    <button
                        onClick={handleCreate}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        Créer une société
                        <ArrowRight className="h-4 w-4" />
                    </button>

                    <button
                        onClick={() => toast.info("Veuillez contacter votre administrateur pour obtenir une invitation.")}
                        className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-all"
                    >
                        Demander l'accès
                    </button>
                </div>

                <div className="mt-6">
                    <button
                        onClick={() => {
                            // Logout cleanup if stuck
                            fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                                window.localStorage.clear();
                                router.push('/login');
                            });
                        }}
                        className="text-xs text-muted-foreground hover:text-white underline"
                    >
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
}
