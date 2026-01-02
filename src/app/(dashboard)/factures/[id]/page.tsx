"use client";

import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { use, useEffect, useState, useCallback } from "react";
import { Facture } from "@/types";
import { useParams, useRouter } from "next/navigation";
import { fetchInvoiceDetails } from "@/app/actions";

export default function EditFacturePage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 requires awaiting params
    const { id } = use(params);
    const router = useRouter();
    const [invoice, setInvoice] = useState<Facture | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFullInvoice = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        // Clear error on retry
        if (!silent) setError(null);

        try {
            const res = await fetchInvoiceDetails(id);
            if (res.success && res.data) {
                setInvoice(res.data);
                setError(null);
            } else {
                console.error("Invoice not found or error:", res.error);
                if (!silent) {
                    // Don't redirect automatically to avoid 404 loops or confusion
                    setError(res.error || "Facture introuvable");
                }
            }
        } catch (error) {
            console.error("Failed to fetch invoice details", error);
            if (!silent) setError("Erreur de chargement");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadFullInvoice();
    }, [loadFullInvoice]);

    // Sync Refetch on Focus
    useEffect(() => {
        const onFocus = () => {
            if (document.visibilityState === 'visible') {
                console.log("[INVOICE PAGE] Refetching on focus...");
                loadFullInvoice(true);
            }
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('visibilitychange', onFocus);
        };
    }, [loadFullInvoice]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground">Chargement de la facture...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <p className="text-red-500 font-medium">{error}</p>
                <button
                    onClick={() => router.push('/factures')}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    Retour aux factures
                </button>
            </div>
        );
    }

    if (!invoice) return null;

    // Use updatedAt as key to force re-render when data updates externally (Mobile sync)
    return <InvoiceEditor key={invoice.updatedAt ? new Date(invoice.updatedAt).getTime() : 'init'} type="Facture" initialData={invoice} />;
}
