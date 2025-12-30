"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Mail, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function PendingVerificationPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const email = searchParams?.get("email");
    const [isLoading, setIsLoading] = useState(false);
    const [lastSent, setLastSent] = useState(Date.now());
    const [countdown, setCountdown] = useState(0);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleResend = async () => {
        if (!email) return;
        if (countdown > 0) return;

        try {
            const res = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                toast.success("Email renvoyé !");
                setLastSent(Date.now());
                setCountdown(60); // 1 minute cooldown
            } else {
                const data = await res.json();
                toast.error(data.error || "Erreur lors de l'envoi");
                if (res.status === 429) setCountdown(60);
            }
        } catch (error) {
            toast.error("Erreur de connexion");
        }
    };

    const handleManualVerify = async () => {
        setIsLoading(true);
        try {
            // Call API to mark as verified (Temporary Bypass or Real Check)
            const res = await fetch('/api/auth/manual-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                toast.success("Email vérifié ! Redirection...");
                // Force hard reload to pick up new user state if needed, or router push
                window.location.href = "/onboarding";
            } else {
                // If it fails (maybe verifying actual token?), handle error
                const data = await res.json();
                toast.error(data.error || "Vérification échouée. Veuillez utiliser le lien dans l'email.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la vérification");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(120,60,255,0.1),rgba(0,0,0,0))]" />

            <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-8">
                    <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                        <Mail className="h-8 w-8 text-blue-400" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">Vérifiez votre email</h1>
                    <p className="text-muted-foreground">
                        Un lien de confirmation a été envoyé à <br />
                        <span className="text-white font-medium">{email || "votre adresse email"}</span>
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground text-center">
                        <p>Cliquez sur le lien dans l'email pour activer votre compte et accéder à la plateforme.</p>
                    </div>

                    {/* Resend Button */}
                    <button
                        onClick={handleResend}
                        disabled={countdown > 0}
                        className="w-full py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {countdown > 0 ? (
                            <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Renvoyer dans {countdown}s
                            </>
                        ) : (
                            "Je n'ai rien reçu, renvoyer l'email"
                        )}
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0a0a0f] px-2 text-muted-foreground">Ou</span></div>
                    </div>

                    {/* Manual Verify Button (Bypass for now) */}
                    <button
                        onClick={handleManualVerify}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                        J'ai validé mon email
                    </button>

                    <p className="text-xs text-center text-muted-foreground mt-4">
                        En cliquant sur ce bouton, nous vérifierons le statut de votre compte.
                    </p>
                </div>

                <div className="mt-8 text-center">
                    <Link href="/login" className="text-sm text-muted-foreground hover:text-white transition-colors">
                        Retour à la connexion
                    </Link>
                </div>
            </div>
        </div>
    );
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
