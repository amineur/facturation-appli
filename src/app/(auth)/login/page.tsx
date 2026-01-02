"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { dataService } from "@/lib/data-service";
import { Lock, Mail, ArrowRight, Loader2, User } from "lucide-react";
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
                        email: data.email, // Validation handled by server
                        password: data.password,
                        fullName: data.fullName
                    })
                });
                const result = await res.json();

                if (!res.ok) throw new Error(result.error || "Erreur inscription");

                // Redirect to Pending Verification (Intermediate Step)
                const redirectUrl = `/pending-verification?email=${encodeURIComponent(data.email)}`;

                // Use window.location for more reliable redirect
                window.location.href = redirectUrl;

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
                    // CLEAR SCOPE
                    localStorage.removeItem('glassy_active_societe');
                    localStorage.removeItem('active_societe_id');
                    localStorage.setItem("glassy_current_user_id", user.id);

                    // refreshData(); // Redundant with hard reload below
                    // Hard reload to ensure cookie is picked up by server actions immediately

                    // Conditional Redirect: If no society -> Onboarding, else -> Dashboard
                    if (user.societes && user.societes.length > 0) {
                        window.location.href = "/";
                    } else {
                        window.location.href = "/onboarding";
                    }
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
        // Added relative z-50 to container and removed standard glass-card to manually control it
        <div className="relative z-50 bg-background/90 backdrop-blur-xl p-8 rounded-2xl border border-border shadow-2xl">
            <div className="text-center mb-8">
                <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                    <Lock className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                    {isSignup ? "Créer un compte" : "Connexion"}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {isSignup ? "Rejoignez-nous en quelques secondes" : "Accédez à votre espace de gestion"}
                </p>
            </div>

            <form suppressHydrationWarning onSubmit={async (e) => {
                // e.preventDefault(); // Removed to let mobile browser handle it natively if JS fails? No, keeps it.
                // e.stopPropagation();
                // console.log('[FORM] Form submitted detected on form tag');
                await handleSubmit(onSubmit)(e);
            }} className="space-y-4 relative z-50">
                {/* Full Name Field (Signup Only) */}
                {isSignup && (
                    <div className="space-y-2 relative z-50">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Nom complet</label>
                        <div className="relative group z-50">
                            <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                            <input
                                {...register("fullName", { required: isSignup })}
                                className="w-full glass-input rounded-xl py-2.5 pl-10 pr-4 placeholder:text-muted-foreground/50 transition-all text-foreground bg-background/50 border-white/10 focus:border-primary/50 relative z-50"
                                placeholder="Jean Dupont"
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2 relative z-50">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Email</label>
                    <div className="relative group z-50" suppressHydrationWarning>
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                        <input
                            {...register("email", { required: "L'email est requis", pattern: { value: /^\S+@\S+$/i, message: "Email invalide" } })}
                            type="email"
                            className="w-full glass-input rounded-xl py-2.5 pl-10 pr-4 placeholder:text-muted-foreground/50 transition-all text-foreground bg-background/50 border-white/10 focus:border-primary/50 relative z-50"
                            placeholder="exemple@email.com"
                            suppressHydrationWarning
                        />
                    </div>
                    {errors.email && <p className="text-xs text-destructive mt-1 ml-1 font-medium bg-destructive/10 p-1 rounded">{(errors.email as any).message}</p>}
                </div>

                <div className="space-y-2 relative z-50">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Mot de passe</label>
                        {!isSignup && <a href="/forgot-password" className="text-xs text-primary hover:text-primary/80 relative z-50">Oublié ?</a>}
                    </div>
                    <div className="relative group z-50" suppressHydrationWarning>
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                        <input
                            {...register("password", { required: "Mot de passe requis", minLength: { value: 6, message: "6 caractères minimum" } })}
                            type="password"
                            className="w-full glass-input rounded-xl py-2.5 pl-10 pr-4 placeholder:text-muted-foreground/50 transition-all text-foreground bg-background/50 border-white/10 focus:border-primary/50 relative z-50"
                            placeholder={isSignup ? "Minimum 6 caractères" : "••••••••"}
                            suppressHydrationWarning
                        />
                    </div>
                    {errors.password && <p className="text-xs text-destructive mt-1 ml-1 font-medium bg-destructive/10 p-1 rounded">{(errors.password as any).message}</p>}
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-zinc-950 font-bold py-3 rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-6 relative z-50 cursor-pointer touch-manipulation disabled:opacity-70 disabled:cursor-wait"
                    style={{ transform: 'translateZ(0)' }} // Force GPU layer
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

            <div className="mt-8 pt-6 border-t border-border text-center relative z-50">
                <p className="text-sm text-muted-foreground">
                    {isSignup ? "Déjà un compte ?" : "Pas encore de compte ?"} {" "}
                    <button
                        type="button"
                        onClick={() => setIsSignup(!isSignup)}
                        className="text-primary hover:underline font-bold relative z-50 cursor-pointer"
                    >
                        {isSignup ? "Se connecter" : "Créer un compte"}
                    </button>
                </p>
            </div>

        </div>
    );
}
