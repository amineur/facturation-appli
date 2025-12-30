"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, CheckCircle, XCircle } from "lucide-react";

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError("Token manquant");
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas");
            return;
        }

        if (newPassword.length < 6) {
            setError("Le mot de passe doit contenir au moins 6 caractères");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/login'), 3000);
            } else {
                setError(data.error || "Erreur lors de la réinitialisation");
            }
        } catch (err) {
            setError("Erreur serveur. Réessaye plus tard.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="glass-card rounded-2xl p-8 max-w-md w-full">
                {success ? (
                    <div className="text-center">
                        <div className="mb-6">
                            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-4">
                            Mot de passe réinitialisé ! ✅
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Ton mot de passe a été changé avec succès. Redirection vers la connexion...
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <Lock className="h-12 w-12 text-blue-500 mb-4" />
                            <h1 className="text-2xl font-bold text-foreground mb-2">
                                Nouveau mot de passe
                            </h1>
                            <p className="text-muted-foreground">
                                Choisis un nouveau mot de passe sécurisé.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-500">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Nouveau mot de passe
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Confirmer le mot de passe
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !token}
                                className="w-full h-11 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors"
                            >
                                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                                Retour à la connexion
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
