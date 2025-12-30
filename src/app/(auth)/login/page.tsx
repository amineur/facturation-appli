"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { dataService } from "@/lib/data-service";
import { Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/components/data-provider";

export default function LoginPage() {
    const router = useRouter();
    const { refreshData } = useData();
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm({
        defaultValues: {
            email: "",
            password: "",
            fullName: ""
        }
    });

    const [isSignup, setIsSignup] = useState(false);

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            if (isSignup) {
                // SIGNUP LOGIC
                const res = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password,
                        fullName: data.fullName
                    })
                });
                const result = await res.json();

                if (!res.ok) throw new Error(result.error || "Erreur inscription");

                toast.success("Compte créé ! Vérifie ton email.");

                // Redirect to pending verification page with email
                const email = result.email || data.email;
                const redirectUrl = `/pending-verification?email=${encodeURIComponent(email)}`;

                // Use window.location for more reliable redirect
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 500); // Small delay for toast to show

            } else {
                // LOGIN LOGIC (via API for Cookie)
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password
                    })
                });
                const result = await res.json();

                if (!res.ok) throw new Error(result.error || "Erreur connexion");

                const user = result.user;
                if (user) {
                    toast.success(`Bon retour, ${user.fullName}`);

                    // CLEAR SCOPE
                    localStorage.removeItem('glassy_active_societe');
                    localStorage.removeItem('active_societe_id');
                    localStorage.setItem("glassy_current_user_id", user.id);

                    // refreshData(); // Redundant with hard reload below
                    // Hard reload to ensure cookie is picked up by server actions immediately
                    window.location.href = "/";
                }
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Une erreur est survenue");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-card p-8 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-8">
                <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <Lock className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                    {isSignup ? "Créer un compte" : "Connexion"}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {isSignup ? "Rejoignez-nous en quelques secondes" : "Accédez à votre espace de gestion"}
                </p>
            </div>



            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Full Name Field (Signup Only) */}
                {isSignup && (
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Nom complet</label>
                        <input
                            {...register("fullName", { required: isSignup })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="Jean Dupont"
                        />
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Email</label>
                    <div className="relative group">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground group-focus-within:text-white transition-colors" />
                        <input
                            {...register("email", { required: true })}
                            type="email"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="exemple@email.com"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Mot de passe</label>
                        {!isSignup && <a href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300">Oublié ?</a>}
                    </div>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground group-focus-within:text-white transition-colors" />
                        <input
                            {...register("password", { required: true, minLength: 6 })}
                            type="password"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder={isSignup ? "Minimum 6 caractères" : "••••••••"}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <>
                            {isSignup ? "Créer mon compte" : "Se connecter"}
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-sm text-muted-foreground">
                    {isSignup ? "Déjà un compte ?" : "Pas encore de compte ?"} {" "}
                    <button
                        type="button"
                        onClick={() => setIsSignup(!isSignup)}
                        className="text-white hover:underline font-medium"
                    >
                        {isSignup ? "Se connecter" : "Créer un compte"}
                    </button>
                </p>
            </div>



        </div>
    );
}
