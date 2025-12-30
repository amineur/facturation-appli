"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            // Always show success message (anti-enumeration)
            setSubmitted(true);
        } catch (error) {
            console.error(error);
            setSubmitted(true); // Still show success
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="glass-card rounded-2xl p-8 max-w-md w-full">
                <Link href="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour à la connexion
                </Link>

                {!submitted ? (
                    <>
                        <div className="mb-6">
                            <Mail className="h-12 w-12 text-blue-500 mb-4" />
                            <h1 className="text-2xl font-bold text-foreground mb-2">
                                Mot de passe oublié ?
                            </h1>
                            <p className="text-muted-foreground">
                                Entre ton email et on t'enverra un lien pour réinitialiser ton mot de passe.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                    placeholder="ton@email.com"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors"
                            >
                                {loading ? 'Envoi...' : 'Envoyer le lien'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="text-center">
                        <div className="mb-6">
                            <Mail className="h-16 w-16 text-emerald-500 mx-auto" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-4">
                            Email envoyé ! 📧
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Si un compte existe avec cet email, tu recevras un lien de réinitialisation dans quelques minutes.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Pense à vérifier tes spams.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
