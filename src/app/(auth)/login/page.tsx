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
            password: ""
        }
    });

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            // Simulate network delay for realism
            await new Promise(resolve => setTimeout(resolve, 800));

            const user = await dataService.login(data.email, data.password);

            if (user) {
                toast.success(`Bon retour, ${user.fullName}`);
                refreshData(); // Refresh context with new user
                router.push("/"); // Redirect to dashboard
            } else {
                toast.error("Email ou mot de passe incorrect");
            }
        } catch (error) {
            console.error(error);
            toast.error("Une erreur est survenue");
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
                <h1 className="text-2xl font-bold text-white mb-2">Connexion</h1>
                <p className="text-sm text-muted-foreground">Accédez à votre espace de gestion</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Email</label>
                    <div className="relative group">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground group-focus-within:text-white transition-colors" />
                        <input
                            {...register("email", { required: true })}
                            type="email"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                            placeholder="exemple@email.com"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">Mot de passe</label>
                        <a href="#" className="text-xs text-blue-400 hover:text-blue-300">Oublié ?</a>
                    </div>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground group-focus-within:text-white transition-colors" />
                        <input
                            {...register("password", { required: true })}
                            type="password"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                            placeholder="••••••••"
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
                            Se connecter
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-sm text-muted-foreground">
                    Pas encore de compte ?{" "}
                    <button onClick={() => toast.info("Fonctionnalité d'inscription à venir")} className="text-white hover:underline font-medium">
                        Créer un compte
                    </button>
                </p>
            </div>

            {/* Dev Helper - TO BE REMOVED */}
            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/5 text-xs text-muted-foreground text-center">
                <p>Comptes de test :</p>
                <div className="flex justify-center gap-2 mt-1 font-mono text-white/70">
                    <span className="bg-black/20 px-1 rounded">admin@glassy.com</span>
                    <span className="bg-black/20 px-1 rounded">user@glassy.com</span>
                </div>
            </div>
        </div>
    );
}
