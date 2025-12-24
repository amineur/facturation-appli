"use client";

import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { useData } from "@/components/data-provider";
import { use, useEffect, useState } from "react";
import { Devis } from "@/types";
import { useParams, useRouter } from "next/navigation";

export default function EditDevisPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 requires awaiting params
    const { id } = use(params);
    const { quotes, refreshData, isLoading: isDataLoading } = useData();
    const router = useRouter(); // Initialize router
    const [quote, setQuote] = useState<Devis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadQuote = async () => {
            // 1. Try to find in global state first (optimistic)
            const cached = quotes.find(q => q.id === id);

            // If cached has items, use it (it's a full version)
            // But if it's lite (items empty), we MIGHT need to fetch. 
            // However, a new quote might genuinely have no items.
            // Best strategy: If we have a cached version, display it immediately (skeleton/lite), 
            // AND fetch details in background if we suspect it's stale or lite.
            // For now, simpler: Just fetch details to be safe and ensure "Full" object.

            if (cached && cached.items && cached.items.length > 0) {
                if (isMounted) {
                    setQuote(cached);
                    setLoading(false);
                }
                // Return early? Or verify fresh? Let's trust cache if it has items for speed.
                return;
            }

            // 2. Fetch fresh details
            try {
                const { fetchQuoteDetails } = await import("@/app/actions");
                const result = await fetchQuoteDetails(id);
                if (result.success && result.data) {
                    if (isMounted) {
                        setQuote(result.data);
                        setLoading(false);
                    }
                } else {
                    if (isMounted) {
                        // If not found, redirect
                        router.push('/devis');
                    }
                }
            } catch (error) {
                console.error("Failed to load quote details", error);
                if (isMounted) router.push('/devis');
            }
        };

        if (id) {
            loadQuote();
        }

        return () => { isMounted = false; };
    }, [id, quotes, router]); // Quotes dependency allows update if global state changes, but we primarily fetch.

    if (loading && !quote) {
        return <div className="p-8 text-center text-muted-foreground">Chargement du devis...</div>;
    }

    if (!quote) return null;

    return <InvoiceEditor type="Devis" initialData={quote} />;
}
