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
        if (!isDataLoading) {
            const found = quotes.find(q => q.id === id);
            if (found) {
                setQuote(found);
                setLoading(false);
            } else {
                // If not found (e.g. after company switch), redirect to list
                router.push('/devis');
            }
        }
    }, [id, quotes, isDataLoading, router]);

    if (loading && !quote) {
        return <div className="p-8 text-center text-muted-foreground">Chargement du devis...</div>;
    }

    // This part should rarely be reached due to redirect, but kept for safety
    if (!quote) return null;

    return <InvoiceEditor type="Devis" initialData={quote} />;
}
