"use client";

import { useEffect, useState } from "react";
import { fetchHistory } from "@/lib/actions/history";
import { useData } from "@/components/data-provider";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { safeFormat } from "@/lib/date-utils";
import { Clock, FileText, Receipt, Users, Package, Trash2, Edit2, Plus, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileHistory() {
    const { societe } = useData();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function load() {
            if (!societe?.id) return;
            try {
                const res = await fetchHistory(50, societe.id);
                if (isMounted && res.success && res.data) {
                    setHistory(res.data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        load();
        return () => { isMounted = false; };
    }, [societe?.id]);

    const getIcon = (type: string, action: string) => {
        if (action === 'delete') return <Trash2 className="h-4 w-4 text-red-500" />;
        if (action === 'create') return <Plus className="h-4 w-4 text-emerald-500" />;
        if (action === 'update') return <Edit2 className="h-4 w-4 text-orange-500" />;

        switch (type) {
            case 'facture': return <Receipt className="h-4 w-4 text-blue-500" />;
            case 'devis': return <FileText className="h-4 w-4 text-purple-500" />;
            case 'client': return <Users className="h-4 w-4 text-orange-500" />;
            case 'produit': return <Package className="h-4 w-4 text-indigo-500" />;
            default: return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;

    return (
        <div className="p-4 space-y-4 pb-32 font-sans">
            <div>
                <h1 className="text-2xl font-bold">Historique</h1>
                <p className="text-sm text-muted-foreground">Journal d'activité global</p>
            </div>

            <div className="space-y-3">
                {history.map((item) => (
                    <div key={item.id} className="bg-card p-4 rounded-xl border border-border/50 flex gap-4 items-start">
                        <div className="mt-1 h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                            {getIcon(item.entityType, item.action)}
                        </div>
                        <div>
                            <p className="text-sm font-medium">{item.description}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                <span>{item.userName}</span>
                                <span>•</span>
                                <span>{safeFormat(item.timestamp, "d MMM 'à' HH:mm")}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {history.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        Aucun historique disponible.
                    </div>
                )}
            </div>
        </div>
    );
}
