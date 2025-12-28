"use client";

import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { use, useEffect, useState } from "react";
import { Facture } from "@/types";
import { useParams, useRouter } from "next/navigation";
import { fetchInvoiceDetails } from "@/app/actions";

export default function EditFacturePage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 requires awaiting params
    const { id } = use(params);
    const router = useRouter();
    const [invoice, setInvoice] = useState<Facture | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function loadFullInvoice() {
            setLoading(true);
            try {
                // Fetch fresh details from server (bypassing Lite context)
                const res = await fetchInvoiceDetails(id);

                if (isMounted) {
                    if (res.success && res.data) {
                        setInvoice(res.data);
                    } else {
                        console.error("Invoice not found or error:", res.error);
                        router.push('/factures');
                    }
                    setLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch invoice details", error);
                if (isMounted) {
                    setLoading(false);
                    // Optionally show error state instead of infinite loading
                }
            }
        }

        loadFullInvoice();

        return () => { isMounted = false; };
    }, [id, router]); // Dependency array minimized

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

    if (!invoice) return null;

    return <InvoiceEditor type="Facture" initialData={invoice} />;
}
