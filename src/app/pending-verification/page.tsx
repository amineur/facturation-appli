"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, RefreshCw, CheckCircle, AlertCircle, Inbox } from "lucide-react";

export default function PendingVerificationPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<"success" | "error" | "">("");

    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) {
            setEmail(emailParam);
        } else {
            // No email provided, redirect to login
            router.push('/login');
        }
    }, [searchParams, router]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleResend = async () => {
        if (cooldown > 0 || !email) return;

        setResending(true);
        setMessage("");

        try {
            const res = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (res.ok) {
                if (data.alreadyVerified) {
                    setMessage("Ton email est déjà vérifié ! Redirection...");
                    setMessageType("success");
                    setTimeout(() => router.push('/login'), 2000);
                } else {
                    setMessage("Email renvoyé ! Vérifie ta boîte mail.");
                    setMessageType("success");
                    setCooldown(60); // 60 seconds cooldown
                }
            } else {
                setMessage(data.error || "Erreur lors du renvoi");
                setMessageType("error");
            }
        } catch (error) {
            setMessage("Erreur réseau. Réessaye plus tard.");
            setMessageType("error");
        } finally {
            setResending(false);
        }
    };

    const handleCheckVerification = async () => {
        if (!email) return;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password: '' // Will fail but we just want to check verification status
                })
            });

            const data = await res.json();

            // If error is NOT about email verification, it means email is verified
            if (!data.error || !data.error.includes('Email non vérifié')) {
                setMessage("Email vérifié ! Redirection vers la connexion...");
                setMessageType("success");
                setTimeout(() => router.push('/login'), 2000);
            } else {
                setMessage("Email pas encore vérifié. Vérifie ta boîte mail.");
                setMessageType("error");
            }
        } catch (error) {
            setMessage("Erreur lors de la vérification");
            setMessageType("error");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="glass-card rounded-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <Mail className="h-16 w-16 text-blue-500 mx-auto" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        Vérifie ton email 📧
                    </h1>
                    <p className="text-muted-foreground mb-4">
                        On a envoyé un email de vérification à :
                    </p>
                    <div className="bg-white/5 rounded-lg p-3 mb-6">
                        <p className="text-foreground font-medium break-all">
                            {email}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Inbox className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-300">
                                <p className="font-medium mb-1">Clique sur le lien dans l'email</p>
                                <p className="text-blue-300/80">
                                    Le lien est valable pendant 1 heure. Pense à vérifier tes spams si tu ne le vois pas.
                                </p>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${messageType === 'success'
                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                : 'bg-red-500/10 border border-red-500/20'
                            }`}>
                            {messageType === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                            <p className={`text-sm ${messageType === 'success' ? 'text-emerald-300' : 'text-red-300'
                                }`}>
                                {message}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={handleResend}
                        disabled={resending || cooldown > 0}
                        className="w-full h-11 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                        {cooldown > 0
                            ? `Renvoyer l'email (${cooldown}s)`
                            : resending
                                ? 'Envoi...'
                                : "Renvoyer l'email"
                        }
                    </button>

                    <button
                        onClick={handleCheckVerification}
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
                    >
                        J'ai vérifié mon email
                    </button>

                    <div className="text-center pt-4">
                        <Link
                            href="/login"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Retour à la connexion
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
