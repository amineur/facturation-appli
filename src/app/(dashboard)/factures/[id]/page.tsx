"use client";

import { InvoiceEditor } from "@/components/features/InvoiceEditor";
import { useData } from "@/components/data-provider";
import { use, useEffect, useState } from "react";
import { Facture } from "@/types";
import { useParams } from "next/navigation";

export default function EditFacturePage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 requires awaiting params
    const { id } = use(params);
    const { invoices, refreshData } = useData();
    const [invoice, setInvoice] = useState<Facture | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (invoices.length > 0) {
            const found = invoices.find(inv => inv.id === id);
            setInvoice(found || null);
            setLoading(false);
        }
    }, [id, invoices]);

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Chargement de la facture...</div>;
    }

    if (!invoice) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-500 mb-2">Facture introuvable</h2>
                <p className="text-muted-foreground">La facture demandée (ID: {id}) n'existe pas ou a été supprimée.</p>
            </div>
        );
    }

    return <InvoiceEditor type="Facture" initialData={invoice} />;
}
