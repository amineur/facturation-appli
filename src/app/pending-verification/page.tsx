"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PendingVerificationPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to home immediately since we are in Safe Mode
        router.push('/');
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="text-white">Redirection en cours...</div>
        </div>
    );
}
