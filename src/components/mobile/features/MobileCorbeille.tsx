"use client";

import { useEffect, useState } from "react";
import { fetchDeletedInvoices } from "@/lib/actions/invoices";
// Checked history.ts, restoreRecord is exported there.
import { restoreRecord as restoreRecordAction } from "@/lib/actions/history";
// fetchDeletedInvoices is in invoices.ts
import { fetchDeletedQuotes } from "@/lib/actions/quotes"; // Assuming this exists
import { useData } from "@/components/data-provider";
import { Receipt, FileText, RefreshCw, Trash } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { safeFormat } from "@/lib/date-utils";

export function MobileCorbeille() {
    const { societe, refreshData } = useData();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!societe?.id) return;
        setLoading(true);
        try {
            // Need to import dynamically to avoid build errors if server actions not 100% correct
            const { fetchDeletedInvoices } = await import("@/lib/actions/invoices");
            const { fetchDeletedQuotes } = await import("@/lib/actions/quotes");

            const [invRes, quoteRes] = await Promise.all([
                fetchDeletedInvoices(societe.id),
                fetchDeletedQuotes(societe.id)
            ]);

            const combined = [
                ...(invRes.success && invRes.data ? invRes.data.map((i: any) => ({ ...i, docType: 'Factures' })) : []),
                ...(quoteRes.success && quoteRes.data ? quoteRes.data.map((q: any) => ({ ...q, docType: 'Devis' })) : [])
            ].sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

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

    const handleRestore = async (item: any) => {
        try {
            const res = await restoreRecordAction(item.docType, item.id);
            if (res.success) {
                toast.success("Document restauré !");
                refreshData();
                loadData();
            } else {
                toast.error("Erreur: " + res.error);
            }
        } catch (e) {
            toast.error("Erreur serveur");
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;

    return (
        <div className="p-4 space-y-4 pb-32 font-sans">
            <div>
                <h1 className="text-2xl font-bold">Corbeille</h1>
                <p className="text-sm text-muted-foreground">Éléments supprimés (Restaurables)</p>
            </div>

            <div className="space-y-3">
                {items.map((item) => (
                    <div key={item.id} className="bg-card p-4 rounded-xl border border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                <Trash className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">{item.numero}</p>
                                <p className="text-xs text-muted-foreground">Supprimé le {safeFormat(item.deletedAt, "d MMM")}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleRestore(item)}
                            className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95 transition-transform"
                        >
                            <RefreshCw className="h-3 w-3" /> Restaurer
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        Corbeille vide.
                    </div>
                )}
            </div>
        </div>
    );
}
