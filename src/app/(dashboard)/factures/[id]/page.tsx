"use client";

import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { useData } from "@/components/data-provider";
import { use, useEffect, useState } from "react";
import { Facture } from "@/types";
import { useParams, useRouter } from "next/navigation";

export default function EditFacturePage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 requires awaiting params
    const { id } = use(params);
    const { invoices, refreshData, isLoading: isDataLoading } = useData();
    const router = useRouter(); // Initialize router
    const [invoice, setInvoice] = useState<Facture | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isDataLoading) {
            const found = invoices.find(inv => inv.id === id);
            if (found) {
                setInvoice(found);
                setLoading(false);
            } else {
                // If not found (e.g. after company switch), redirect to list
                router.push('/factures');
            }
        }
    }, [id, invoices, isDataLoading, router]);

    if (loading || isDataLoading) {
        return <div className="p-8 text-center text-muted-foreground">Chargement de la facture...</div>;
    }

    // This part should rarely be reached due to redirect, but kept for safety
    if (!invoice) return null;

    return <InvoiceEditor type="Facture" initialData={invoice} />;
}
