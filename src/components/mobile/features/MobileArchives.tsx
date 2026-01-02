"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/data-provider";
import { Archive, Receipt, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function MobileArchives() {
    const { societe } = useData();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!societe?.id) return;
        setLoading(true);
        try {
            const { fetchArchivedInvoices } = await import("@/lib/actions/invoices");
            // Assuming fetchArchivedQuotes exists
            let quotesData = [];
            try {
                const { fetchArchivedQuotes } = await import("@/lib/actions/quotes");
                const qRes = await fetchArchivedQuotes(societe.id);
                if (qRes.success && qRes.data) quotesData = qRes.data.map((q: any) => ({ ...q, docType: 'Devis' }));
            } catch (e) { /* ignore if not implemented yet */ }

            const invRes = await fetchArchivedInvoices(societe.id);
            const invData = invRes.success && invRes.data ? invRes.data.map((i: any) => ({ ...i, docType: 'Factures' })) : [];

            const combined = [...invData, ...quotesData]
                .sort((a, b) => new Date(b.archivedAt || b.updatedAt).getTime() - new Date(a.archivedAt || a.updatedAt).getTime());

            setItems(combined);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [societe?.id]);


    return (
        <div className="p-4 space-y-4 pb-32">
            <div>
                <h1 className="text-2xl font-bold">Archives</h1>
                <p className="text-sm text-muted-foreground">Documents archivés (Lecture seule)</p>
            </div>

            <div className="space-y-3">
                {items.map((item) => (
                    <div key={item.id} className="bg-card p-4 rounded-xl border border-border/50 opacity-75">
                        <div className="flex items-center gap-3 mb-2">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{item.numero}</span>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded ml-auto">{item.docType}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <p className="text-xs text-muted-foreground">
                                {item.archivedAt ? `Archivé le ${format(new Date(item.archivedAt), "d MMM yy", { locale: fr })}` : "Archivé"}
                            </p>
                            <p className="font-bold text-sm">{item.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                        </div>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        Aucune archive.
                    </div>
                )}
            </div>
        </div>
    );
}
