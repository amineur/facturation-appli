"use client";

import { useData } from "@/components/data-provider";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, endOfDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, FileText, Users, TrendingUp, ArrowUpRight, AlertTriangle, Clock, Calendar, BarChart3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDashboardState } from "@/components/providers/dashboard-state-provider";
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";
import { useMemo } from "react";

export function MobileDashboard() {
    const { invoices, quotes, clients } = useData();
    const {
        dateRange, setDateRange,
        customStart, setCustomStart,
        customEnd, setCustomEnd
    } = useDashboardState();

    // -- 1. Filtering Logic (Matches Desktop) --
    const filteredData = useMemo(() => {
        const now = new Date();
        let start = startOfMonth(now);
        let end = endOfDay(now);

        if (dateRange === "total") {
            start = parseISO("2000-01-01");
            end = endOfDay(now);
        } else if (dateRange === "3months") {
            start = subMonths(now, 3);
            end = endOfDay(now);
        } else if (dateRange === "month") {
            start = startOfMonth(now);
            end = endOfMonth(now);
        } else {
            if (customStart && customEnd) {
                start = startOfDay(parseISO(customStart));
                end = endOfDay(parseISO(customEnd));
            }
        }

        const filterDate = (dateStr: string) => {
            const date = parseISO(dateStr);
            return isWithinInterval(date, { start, end });
        };

        return {
            invoices: invoices.filter(inv => filterDate(inv.dateEmission)),
            quotes: quotes.filter(q => filterDate(q.dateEmission)),
            start,
            end
        };
    }, [invoices, quotes, dateRange, customStart, customEnd]);

    // -- 2. KPI Calculations --
    const kpi = useMemo(() => {
        const payedInvoices = filteredData.invoices.filter(i => i.statut === "Payée");
        const pendingInvoices = filteredData.invoices.filter(i => ["Envoyée", "Retard", "Envoyé"].includes(i.statut));

        const revenue = payedInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
        const pending = pendingInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
        const signedQuotes = filteredData.quotes.reduce((sum, q) => (q.statut === "Accepté" || q.statut === "Signé") ? sum + q.totalTTC : sum, 0);

        return { revenue, pending, signedQuotes };
    }, [filteredData]);

    // -- 3. Alerts (Global Scope - Not filtered by date usually, but here we show general health) --
    // Actually alerts usually prioritize "Now" regardless of filter, but let's stick to showing alerts for ALL ACTIVE issues
    const alerts = useMemo(() => {
        const now = new Date();
        const overdue = invoices.filter(inv =>
            inv.statut === "Retard" ||
            (inv.statut !== "Payée" && inv.statut !== "Annulée" && inv.statut !== "Brouillon" && inv.echeance && new Date(inv.echeance) < now)
        );
        const imminent = invoices.filter(inv => {
            if (inv.statut === "Payée" || inv.statut === "Annulée" || inv.statut === "Brouillon" || inv.statut === "Retard") return false;
            if (!inv.echeance) return false;
            const dueDate = new Date(inv.echeance);
            const diffTime = dueDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 3;
        });

        return { overdue, imminent };
    }, [invoices]);

    // -- 4. Chart Data (Monthly breakdown of filtered range) --
    const chartData = useMemo(() => {
        const data = new Map<string, { name: string; value: number }>();
        filteredData.invoices.forEach(inv => {
            if (inv.statut === "Payée") {
                const key = inv.dateEmission.substring(0, 7); // YYYY-MM
                const current = data.get(key) || { name: format(parseISO(inv.dateEmission), "MMM", { locale: fr }), value: 0 };
                current.value += inv.totalTTC;
                data.set(key, current);
            }
        });
        // Sort by date key
        return Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
    }, [filteredData]);

    // -- 5. Activity Feed (Respects Filter) --
    const recentActivity = [
        ...filteredData.invoices.map(i => ({ ...i, type: 'invoice' as const })),
        ...filteredData.quotes.map(q => ({ ...q, type: 'quote' as const }))
    ]
        .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
        .slice(0, 5); // Limit to 5

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Payée":
            case "Accepté": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
            case "Envoyée":
            case "Envoyé": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
            case "Brouillon": return "text-slate-500 bg-slate-500/10 border-slate-500/20";
            case "Retard":
            case "Refusé": return "text-red-500 bg-red-500/10 border-red-500/20";
            default: return "text-muted-foreground bg-muted border-border/50";
        }
    };

    return (
        <div className="p-4 space-y-8 pb-32">
            {/* Header & Date Filters */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
                        <p className="text-sm text-muted-foreground">Activité du {format(filteredData.start, "d MMM", { locale: fr })} au {format(filteredData.end, "d MMM", { locale: fr })}</p>
                    </div>
                    <Link href="/settings" className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-lg active:scale-95 transition-transform" />
                </div>

                {/* Date Filter Scroll */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {[
                        { key: "month", label: "Ce Mois" },
                        { key: "3months", label: "3 Mois" },
                        { key: "total", label: "Total" },
                        // Custom would need a picker, simple toggle for now
                    ].map((opt) => (
                        <button
                            key={opt.key}
                            onClick={() => setDateRange(opt.key as any)}
                            className={cn(
                                "whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium border transition-colors",
                                dateRange === opt.key
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            // Simple toggle to custom for demo, ideally opens a sheet
                            if (dateRange !== "custom") setDateRange("custom");
                        }}
                        className={cn(
                            "whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium border transition-colors",
                            dateRange === "custom"
                                ? "bg-primary text-primary-foreground dark:text-zinc-950 border-primary"
                                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                    >
                        Custom <Calendar className="inline-block ml-1 h-3 w-3" />
                    </button>
                </div>
            </div>

            {/* Alerts Section (Only if issues exist) */}
            {(alerts.overdue.length > 0 || alerts.imminent.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                    {alerts.overdue.length > 0 && (
                        <div className="col-span-2 sm:col-span-1 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-red-500 uppercase tracking-wider">Retard</p>
                                <p className="font-bold text-foreground">{alerts.overdue.length} Factures</p>
                                <p className="text-xs text-red-400/80">
                                    {alerts.overdue.reduce((s, i) => s + i.totalTTC, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                </p>
                            </div>
                        </div>
                    )}
                    {alerts.imminent.length > 0 && (
                        <div className="col-span-2 sm:col-span-1 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                                <Clock className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-orange-500 uppercase tracking-wider">Imminent</p>
                                <p className="font-bold text-foreground">{alerts.imminent.length} Factures</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* KPI Cards Carousel */}
            <div className="grid grid-cols-1 gap-4">
                {/* Revenue Card */}
                <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-border/10 p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp className="h-24 w-24" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-slate-400 mb-1">Chiffre d'affaires</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white tracking-tight">
                                {kpi.revenue.toLocaleString("fr-FR", { style: "decimal", maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-xl font-medium text-slate-400">€</span>
                        </div>

                        {/* Mini Chart */}
                        <div className="h-[60px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <Bar dataKey="value" fill="#10b981" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Secondary KPIs (Horizontal Grid) */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card border border-border/50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-blue-500">
                            <FileText className="h-4 w-4" />
                            <span className="text-xs font-medium">En Attente</span>
                        </div>
                        <p className="text-lg font-bold">
                            {kpi.pending.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                        </p>
                    </div>

                    <div className="bg-card border border-border/50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-purple-500">
                            <Receipt className="h-4 w-4" />
                            <span className="text-xs font-medium">Devis Signés</span>
                        </div>
                        <p className="text-lg font-bold">
                            {kpi.signedQuotes.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>

                {/* Distribution & Summary (New Audit Requirement) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Invoice Status Distribution */}
                    <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Répartition Factures</h3>
                        <div className="space-y-2">
                            {[
                                { label: "Payées", count: filteredData.invoices.filter(i => i.statut === "Payée").length, color: "bg-emerald-500" },
                                { label: "En Retard", count: filteredData.invoices.filter(i => i.statut === "Retard").length, color: "bg-red-500" },
                                { label: "En Attente", count: filteredData.invoices.filter(i => ["Envoyée", "Envoyé"].includes(i.statut)).length, color: "bg-blue-500" },
                                { label: "Brouillons", count: filteredData.invoices.filter(i => i.statut === "Brouillon").length, color: "bg-slate-500" }
                            ].map(stat => (
                                <div key={stat.label} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                                        <span>{stat.label}</span>
                                    </div>
                                    <span className="font-bold">{stat.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Period Summary */}
                    <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Résumé Période</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/30 rounded-xl">
                                <p className="text-xs text-muted-foreground">Factures</p>
                                <p className="font-bold text-lg">{filteredData.invoices.length}</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-xl">
                                <p className="text-xs text-muted-foreground">Devis</p>
                                <p className="font-bold text-lg">{filteredData.quotes.length}</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-xl">
                                <p className="text-xs text-muted-foreground">Clients Actifs</p>
                                <p className="font-bold text-lg">
                                    {new Set([...filteredData.invoices, ...filteredData.quotes].map(i => i.clientId)).size}
                                </p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-xl">
                                <p className="text-xs text-muted-foreground">Tx. Conversion</p>
                                <p className="font-bold text-lg">
                                    {filteredData.quotes.length > 0
                                        ? Math.round((filteredData.quotes.filter(q => q.statut === 'Signé' || q.statut === 'Accepté').length / filteredData.quotes.length) * 100)
                                        : 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Recent Activity */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Activité Récente</h3>
                    <Link href="/factures" className="text-xs text-primary font-medium">Voir tout</Link>
                </div>

                <div className="space-y-3">
                    {recentActivity.map((item) => {
                        const client = clients.find(c => c.id === item.clientId);
                        return (
                            <Link
                                key={item.id}
                                href={item.type === 'invoice' ? `/factures/${item.id}` : `/devis/${item.id}`}
                                className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-sm active:bg-accent/50 transition-colors"
                            >
                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                    item.type === 'invoice' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                                )}>
                                    {item.type === 'invoice' ? <Receipt className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{client?.nom || "Client Inconnu"}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.numero} • {format(new Date(item.dateEmission), "d MMM", { locale: fr })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold">{item.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium inline-block mt-1", getStatusColor(item.statut))}>
                                        {item.statut}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                    {recentActivity.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Aucune activité sur cette période.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
