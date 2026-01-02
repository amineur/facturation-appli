"use client";

import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { useData } from "@/components/data-provider";
import { use, useEffect, useState, useCallback } from "react";
import { Devis } from "@/types";
import { useParams, useRouter } from "next/navigation";

export default function EditDevisPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 requires awaiting params
    const { id } = use(params);
    // const { refreshData } = useData(); // Not needed for detail page self-refresh
    const router = useRouter(); // Initialize router
    const [quote, setQuote] = useState<Devis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        if (!silent) setError(null);
        try {
            // Dynamically import action to avoid build issues if mixed server/client? 
            // Standard import is fine as it's a "use client" file importing "use server" action
            const { fetchQuoteDetails } = await import("@/app/actions");
            const res = await fetchQuoteDetails(id);
            if (res.success && res.data) {
                setQuote(res.data);
                setError(null);
            } else {
                console.error("Quote not found or error:", res.error);
                if (!silent) setError(res.error || "Devis introuvable");
            }
        } catch (e) {
            console.error("Failed to load quote details", e);
            if (!silent) setError("Erreur de chargement");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    // Sync Refetch on Focus
    useEffect(() => {
        const onFocus = () => {
            if (document.visibilityState === 'visible') {
                console.log("[QUOTE PAGE] Refetching on focus...");
                load(true);
            }
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('visibilitychange', onFocus);
        };
    }, [load]);

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center text-muted-foreground">Chargement du devis...</div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <p className="text-red-500 font-medium">{error}</p>
                <button
                    onClick={() => router.push('/devis')}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    Retour aux devis
                </button>
            </div>
        );
    }

    if (!quote) return null;

    // Use updatedAt as key to force re-render when data updates externally (Mobile sync)
    return <InvoiceEditor key={quote.updatedAt ? new Date(quote.updatedAt).getTime() : 'init'} type="Devis" initialData={quote} />;
}
