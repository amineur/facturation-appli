"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

export default function VerifyEmailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorType, setErrorType] = useState<string>('');

    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success === 'true') {
            setStatus('success');
        } else if (error) {
            setStatus('error');
            setErrorType(error);
        }
    }, [searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
                {status === 'success' && (
                    <>
                        <div className="mb-6">
                            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-4">
                            Email vérifié ! ✅
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            Ton adresse email a été vérifiée avec succès. Tu peux maintenant te connecter.
                        </p>
                        <Link
                            href="/login"
                            className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
                        >
                            Se connecter
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="mb-6">
                            {errorType === 'expired' ? (
                                <Clock className="h-16 w-16 text-orange-500 mx-auto" />
                            ) : (
                                <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-4">
                            {errorType === 'expired' ? 'Lien expiré ⏱️' : 'Erreur de vérification ❌'}
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            {errorType === 'expired' && 'Ce lien de vérification a expiré. Demande un nouveau lien.'}
                            {errorType === 'invalid' && 'Ce lien de vérification est invalide ou a déjà été utilisé.'}
                            {errorType === 'server' && 'Une erreur est survenue. Réessaye plus tard.'}
                        </p>
                        <Link
                            href="/login"
                            className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                        >
                            Retour à la connexion
                        </Link>
                    </>
                )}

                {status === 'loading' && (
                    <>
                        <div className="mb-6">
                            <AlertCircle className="h-16 w-16 text-blue-500 mx-auto animate-pulse" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-4">
                            Vérification en cours...
                        </h1>
                        <p className="text-muted-foreground">
                            Patiente un instant.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
