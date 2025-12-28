"use client";

import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { useData } from "@/components/data-provider";
import { use, useEffect, useState } from "react";
import { Devis } from "@/types";
import { useParams, useRouter } from "next/navigation";

export default function EditDevisPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 requires awaiting params
    const { id } = use(params);
    const { refreshData } = useData();
    const router = useRouter(); // Initialize router
    const [quote, setQuote] = useState<Devis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            try {
                // Dynamically import action to avoid build issues if mixed server/client? 
                // Standard import is fine as it's a "use client" file importing "use server" action
                const { fetchQuoteDetails } = await import("@/app/actions");
                const res = await fetchQuoteDetails(id);
                if (isMounted) {
                    if (res.success && res.data) {
                        setQuote(res.data);
                    } else {
                        // If not found, redirect
                        router.push('/devis');
                    }
                    setLoading(false);
                }
            } catch (e) {
                console.error("Failed to load quote details", e);
                if (isMounted) setLoading(false);
            }
        }
        load();
        return () => { isMounted = false; };
    }, [id, router]);

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center text-muted-foreground">Chargement du devis...</div>;
    }

    if (!quote) return null;

    return <InvoiceEditor type="Devis" initialData={quote} />;
}
