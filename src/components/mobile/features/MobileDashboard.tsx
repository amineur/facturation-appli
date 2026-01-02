"use client";

import { useData } from "@/components/data-provider";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, endOfDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, FileText, Users, TrendingUp, ArrowUpRight, AlertTriangle, Clock, Calendar, BarChart3 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDashboardState } from "@/components/providers/dashboard-state-provider";
import { BarChart, Bar, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

const InvoiceStatusChart = dynamic(() => import("@/components/features/InvoiceStatusChart").then(mod => mod.InvoiceStatusChart), {
    loading: () => <div className="w-full h-[250px] animate-pulse bg-muted rounded-xl" />,
    ssr: false
});
const QuoteStatusChart = dynamic(() => import("@/components/features/QuoteStatusChart").then(mod => mod.QuoteStatusChart), {
    loading: () => <div className="w-full h-[250px] animate-pulse bg-muted rounded-xl" />,
    ssr: false
});

export function MobileDashboard() {
    const { invoices, quotes, clients, user } = useData();
    const {
        dateRange, setDateRange,
        customStart, setCustomStart,
        customEnd, setCustomEnd,
        chartMode, setChartMode
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

        const filterDate = (dateStr: string | undefined | null) => {
            if (!dateStr) return false;
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
        const signedQuotes = filteredData.quotes.reduce((sum, q) => (q.statut === "Accepté" || q.statut === "Converti") ? sum + q.totalTTC : sum, 0);

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


    // -- 4. Chart Data (Distribution for Pie Chart) --
    // We need to shape it for InvoiceStatusChart: { name, value, color, amount }

    const invoiceDistribution = useMemo(() => {
        const payed = filteredData.invoices.filter(i => i.statut === "Payée");
        const overdue = filteredData.invoices.filter(i => i.statut === "Retard");
        const draft = filteredData.invoices.filter(i => i.statut === "Brouillon");
        // StatusFacture only has "Envoyée"
        const pending = filteredData.invoices.filter(i => ["Envoyée"].includes(i.statut));

        return [
            { name: "Payées", value: payed.length, amount: payed.reduce((s, i) => s + i.totalTTC, 0), color: "#10B981" },
            { name: "Retard", value: overdue.length, amount: overdue.reduce((s, i) => s + i.totalTTC, 0), color: "#EF4444" },
            { name: "Brouillon", value: draft.length, amount: draft.reduce((s, i) => s + i.totalTTC, 0), color: "#94A3B8" },
            { name: "En Attente", value: pending.length, amount: pending.reduce((s, i) => s + i.totalTTC, 0), color: "#3B82F6" }
        ].filter(d => d.value > 0);
    }, [filteredData]);

    const totalOverdueAmount = useMemo(() => {
        return filteredData.invoices.filter(i => i.statut === "Retard").reduce((s, i) => s + i.totalTTC, 0);
    }, [filteredData]);

    // Bar chart for Revenue (Keeping it small in the KPI card as it looks good, but main chart is now Pie)
    const revenueTrendData = useMemo(() => {
        const data = new Map<string, { name: string; value: number }>();
        filteredData.invoices.forEach(inv => {
            if (inv.statut === "Payée") {
                const key = inv.dateEmission.substring(0, 7);
                const current = data.get(key) || { name: format(parseISO(inv.dateEmission), "MMM", { locale: fr }), value: 0 };
                current.value += inv.totalTTC;
                data.set(key, current);
            }
        });
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
                    <Link href="/settings" className="relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-lg active:scale-95 transition-transform flex items-center justify-center overflow-hidden border border-white/10">
                        {user?.hasAvatar ? (
                            <Image
                                src={`/api/users/avatar/${user.id}?size=80&t=${Date.now()}`}
                                alt="Profil"
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-white font-bold text-sm">{(user?.fullName || "U").charAt(0)}</span>
                        )}
                    </Link>
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

            {/* Distribution & Summary (New Audit Requirement) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Invoice Status Distribution */}
                {/* Main Chart Section (Replaces old List) */}
                <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col items-center">
                    <h3 className="text-lg font-semibold text-foreground mb-4 w-full text-left">
                        Répartition des {chartMode === "factures" ? "Factures" : "Devis"}
                    </h3>
                    <div className="flex bg-muted/50 rounded-lg p-1 mb-4 w-full">
                        <button
                            onClick={() => setChartMode("factures")}
                            className={cn("flex-1 h-8 px-3 text-sm font-medium rounded-md transition-colors", chartMode === "factures" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
                        >
                            Factures
                        </button>
                        <button
                            onClick={() => setChartMode("devis")}
                            className={cn("flex-1 h-8 px-3 text-sm font-medium rounded-md transition-colors", chartMode === "devis" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
                        >
                            Devis
                        </button>
                    </div>

                    <div className="w-full flex justify-center -ml-4">
                        {chartMode === "factures" ? (
                            <InvoiceStatusChart
                                invoices={filteredData.invoices}
                                globalInvoices={[]} // Not needed for visual
                                chartData={invoiceDistribution}
                                totalOverdue={totalOverdueAmount}
                            />
                        ) : (
                            <QuoteStatusChart
                                quotes={filteredData.quotes}
                                globalQuotes={[]} // Not needed for visual
                            />
                        )}
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
                                    ? Math.round((filteredData.quotes.filter(q => q.statut === 'Accepté' || q.statut === 'Converti').length / filteredData.quotes.length) * 100)
                                    : 0}%
                            </p>
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
        </div >
    );
}
