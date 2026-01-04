"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import Link from "next/link";
import {
    AlertCircle,
    Clock,
    TrendingUp,
    FileText,
    Receipt,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { LazyIdle } from "@/components/utils/LazyIdle";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, parseISO, startOfDay, endOfDay, subMonths } from "date-fns";
import { useDashboardState } from "@/components/providers/dashboard-state-provider";
import { fetchDashboardMetrics } from "@/app/actions";
import { Facture, Devis } from "@/types";
import { getClientDisplayName } from "@/lib/client-utils";
import { safeFormat } from "@/lib/date-utils";

const InvoiceStatusChart = dynamic(() => import("@/components/features/InvoiceStatusChart").then(mod => mod.InvoiceStatusChart), {
    loading: () => (
        <div className="glass-card rounded-2xl p-6">
            <Skeleton className="h-[300px] w-full" />
        </div>
    ),
    ssr: false
});
const QuoteStatusChart = dynamic(() => import("@/components/features/QuoteStatusChart").then(mod => mod.QuoteStatusChart), {
    loading: () => (
        <div className="glass-card rounded-2xl p-6">
            <Skeleton className="h-[300px] w-full" />
        </div>
    ),
    ssr: false
});

type DateRangeType = "month" | "custom" | "3months" | "total";
export default function DashboardPage() {
    const { invoices: globalInvoices, quotes, clients, switchSociete, societe, societes } = useData();
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
    const [serverMetrics, setServerMetrics] = useState<any>(null);

    // -- Date Filter State --
    const {
        dateRange, setDateRange,
        customStart, setCustomStart,
        customEnd, setCustomEnd,
        chartMode, setChartMode
    } = useDashboardState();

    // -- Fetch Metrics from Server --
    useEffect(() => {
        let isMounted = true;

        async function loadMetrics() {
            if (!societe?.id) return;

            setIsLoadingMetrics(true);

            // Calculate dates
            const now = new Date();
            let start = startOfMonth(now);
            let end = endOfDay(now);

            if (dateRange === "total") {
                start = parseISO("2000-01-01");
                end = endOfDay(now);
            } else if (dateRange === "3months") {
                start = subMonths(now, 3);
                end = endOfDay(now);
            } else if (dateRange === "custom" && customStart && customEnd) {
                start = startOfDay(parseISO(customStart));
                end = endOfDay(parseISO(customEnd));
            }

            try {
                const res = await fetchDashboardMetrics(societe.id, { start, end });
                if (isMounted && res.success) {
                    setServerMetrics(res.data);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard metrics", error);
            } finally {
                if (isMounted) setIsLoadingMetrics(false);
            }
        }

        loadMetrics();

        return () => { isMounted = false; };
    }, [societe?.id, dateRange, customStart, customEnd]);


    // -- Recent Activity (Client Side for now, could be server too) --
    // We still use globalInvoices for the recent list because fetchInvoicesLite is already efficient enough
    // and we only need a few items.
    const recentActivity = useMemo(() => {
        const sortedInvoices = [...globalInvoices]
            .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
            .slice(0, 3);

        const sortedQuotes = [...quotes]
            .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
            .slice(0, 3);

        return { recentInvoices: sortedInvoices, recentQuotes: sortedQuotes };
    }, [globalInvoices, quotes]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Payée":
            case "Accepté":
            case "Facturé": return "bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/20";
            case "Envoyée":
            case "Envoyé": return "bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/20";
            case "Retard":
            case "Refusé": return "bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2] dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/20";
            default: return "bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/20";
        }
    };

    const handleDateChange = (type: 'start' | 'end', value: string) => {
        setDateRange("custom");
        if (type === 'start') setCustomStart(value);
        else setCustomEnd(value);
    };


    // Use server metrics or fallbacks
    const metrics = serverMetrics || {
        revenue: 0,
        counts: {},
        overdueAmount: 0,
        overdueCount: 0,
        dueSoonAmount: 0,
        dueSoonCount: 0,
        chartData: [] // Chart data would need to be in server response or mapped
    };

    // Map server counts to chart data format if needed
    // The server fetchDashboardMetrics returns 'counts' object: { "Payée": 10, "Brouillon": 2 }
    // We need to map this to chartData expected by InvoiceStatusChart
    // OR we update InvoiceStatusChart to take simple counts.
    // For now, let's reconstruct chartData locally from the counts for the chart component
    const chartData = useMemo(() => {
        if (!serverMetrics) return [];
        return [
            { name: "Payées", value: serverMetrics.counts["Payée"] || 0, amount: serverMetrics.amounts?.["Payée"] || 0, color: "#10B981" },
            { name: "Retard", value: serverMetrics.counts["Retard"] || 0, amount: serverMetrics.amounts?.["Retard"] || 0, color: "#EF4444" },
            { name: "Brouillon", value: serverMetrics.counts["Brouillon"] || 0, amount: serverMetrics.amounts?.["Brouillon"] || 0, color: "#94A3B8" }
        ].filter(d => d.value > 0);
    }, [serverMetrics]);


    // --- EMPTY STATE: NO SOCIETY ---
    // Filter out template societies - users with only templates should see the welcome screen
    const realSocietes = societes?.filter((s: any) => !s.isTemplate) || [];
    if (!societe && !isLoadingMetrics && realSocietes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="h-24 w-24 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <FileText className="h-10 w-10 text-muted-foreground group-hover:text-white transition-colors" />
                </div>

                <div className="max-w-md space-y-2">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Bienvenue !
                    </h2>
                    <p className="text-muted-foreground">
                        Vous n'êtes rattaché à aucune société pour le moment.
                    </p>
                </div>

                <div className="glass-card p-6 rounded-xl border border-white/10 max-w-sm w-full">
                    <h3 className="font-semibold mb-2">Que faire ?</h3>
                    <ul className="text-sm text-left space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-2">
                            <span className="bg-blue-500/10 text-blue-400 rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5 shrink-0">1</span>
                            Attendez qu'un administrateur vous invite. Vous recevrez un email.
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="bg-purple-500/10 text-purple-400 rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5 shrink-0">2</span>
                            Ou créez votre propre société si vous êtes indépendant.
                        </li>
                    </ul>
                    <Link
                        href="/onboarding"
                        className="mt-6 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        Créer ma société
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* --- Header & Controls --- */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Tableau de Bord</h2>
                    <p className="text-muted-foreground mt-1">Vue d'ensemble de votre activité</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 glass-card p-1.5 rounded-xl">
                    <button
                        onClick={() => {
                            setDateRange("total");
                            setCustomStart("2000-01-01");
                            setCustomEnd(format(new Date(), "yyyy-MM-dd"));
                        }}
                        className={cn(
                            "h-8 px-3 text-sm font-medium rounded-md transition-all leading-none flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            dateRange === "total"
                                ? "bg-primary/10 text-primary shadow-sm"
                                : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                    >
                        Total
                    </button>
                    <button
                        onClick={() => {
                            setDateRange("3months");
                            setCustomStart(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
                            setCustomEnd(format(new Date(), "yyyy-MM-dd"));
                        }}
                        className={cn(
                            "h-8 px-3 text-sm font-medium rounded-md transition-all leading-none flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            dateRange === "3months"
                                ? "bg-primary/10 text-primary shadow-sm"
                                : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                    >
                        3 Derniers Mois
                    </button>
                    <button
                        onClick={() => {
                            setDateRange("month");
                            setCustomStart(format(startOfMonth(new Date()), "yyyy-MM-dd"));
                            setCustomEnd(format(endOfDay(new Date()), "yyyy-MM-dd"));
                        }}
                        className={cn(
                            "h-8 px-3 text-sm font-medium rounded-md transition-all leading-none flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            dateRange === "month"
                                ? "bg-primary/10 text-primary shadow-sm"
                                : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                    >
                        Ce Mois
                    </button>

                    <div className="h-6 w-px bg-border hidden sm:block mx-1" />

                    <div className="flex items-center gap-2 px-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Du</span>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => handleDateChange('start', e.target.value)}
                            aria-label="Filtrer par date de début"
                            className="bg-transparent border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px] text-foreground placeholder:text-muted-foreground"
                        />
                        <span className="text-sm text-muted-foreground">au</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => handleDateChange('end', e.target.value)}
                            aria-label="Filtrer par date de fin"
                            className="bg-transparent border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px] text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>
            </div>

            {/* --- Section 1: Chart --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold text-foreground">
                                Répartition des {chartMode === "factures" ? "Factures" : "Devis"}
                            </h3>
                            <div className="flex bg-muted/50 rounded-lg p-1">
                                <button onClick={() => setChartMode("factures")} className={cn("h-8 px-3 text-sm font-medium rounded-md", chartMode === "factures" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>Factures</button>
                                <button onClick={() => setChartMode("devis")} className={cn("h-8 px-3 text-sm font-medium rounded-md", chartMode === "devis" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>Devis</button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        {isLoadingMetrics ? (
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        ) : chartMode === "factures" ? (
                            <LazyIdle placeholder={
                                <div className="glass-card rounded-2xl p-6 w-full">
                                    <Skeleton className="h-[300px] w-full" />
                                </div>
                            }>
                                <InvoiceStatusChart
                                    invoices={[]}
                                    globalInvoices={[]}
                                    chartData={chartData}
                                    totalOverdue={metrics.overdueAmount}
                                />
                            </LazyIdle>
                        ) : (
                            <LazyIdle placeholder={
                                <div className="glass-card rounded-2xl p-6 w-full">
                                    <Skeleton className="h-[300px] w-full" />
                                </div>
                            }>
                                <QuoteStatusChart quotes={quotes} globalQuotes={quotes} />
                            </LazyIdle>
                        )}
                    </div>
                </div>

                {/* Alerts Column */}
                <div className="space-y-6 min-h-[250px]">
                    {isLoadingMetrics ? <Skeleton className="h-[200px] w-full rounded-2xl" /> :
                        (metrics.overdueCount > 0 || metrics.dueSoonCount > 0) ? (
                            <div className="space-y-4">
                                {metrics.overdueCount > 0 && (
                                    <div className="glass-card rounded-2xl p-5 border-l-4 border-red-500">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-red-500/20 rounded-lg shrink-0"><AlertCircle className="h-6 w-6 text-red-500" /></div>
                                            <div>
                                                <h3 className="text-base font-semibold text-foreground">Retard Global</h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    <span className="font-bold text-red-500">{metrics.overdueAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span> en retard ({metrics.overdueCount})
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {metrics.dueSoonCount > 0 && (
                                    <div className="glass-card rounded-2xl p-5 border-l-4 border-orange-500">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-orange-500/20 rounded-lg shrink-0"><Clock className="h-6 w-6 text-orange-500" /></div>
                                            <div>
                                                <h3 className="text-base font-semibold text-foreground">IMMINENT</h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    <span className="font-bold text-orange-500">{metrics.dueSoonAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span> à venir ({metrics.dueSoonCount})
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[150px]">
                                <div className="p-3 bg-emerald-500/10 rounded-full mb-3"><TrendingUp className="h-6 w-6 text-emerald-500" /></div>
                                <h3 className="text-sm font-medium text-foreground">Tout est à jour !</h3>
                            </div>
                        )}

                    {/* Quick Stats */}
                    <div className="glass-card rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Résumé Période</h3>
                        {isLoadingMetrics ? <Skeleton className="h-20 w-full" /> : (
                            <div className="grid grid-cols-2 gap-4 items-start">
                                <div><p className="text-xs text-muted-foreground min-h-[16px]">Chiffre d'Affaires</p><p className="text-xl font-bold text-foreground">{metrics.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p></div>
                                <div><p className="text-xs text-muted-foreground min-h-[16px]">Devis</p><p className="text-xl font-bold text-foreground">{quotes.length}</p></div>
                                <div><p className="text-xs text-muted-foreground min-h-[16px]">Factures</p><p className="text-xl font-bold text-foreground">{Object.values(metrics.counts).reduce((a: any, b: any) => a + b, 0) as number}</p></div>
                                <div><p className="text-xs text-muted-foreground min-h-[16px]">Clients</p><p className="text-xl font-bold text-foreground">{clients.length}</p></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Recent Activity --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Recent Invoices */}
                <div className="glass-card rounded-2xl overflow-hidden min-h-[300px]">
                    <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Factures Récentes</h3>
                        <Link href="/factures" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Voir tout</Link>
                    </div>
                    <div className="divide-y divide-white/5">
                        {recentActivity.recentInvoices.map(invoice => {
                            const client = clients.find(c => c.id === invoice.clientId);
                            return (
                                <div key={invoice.id} className="p-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-semibold text-foreground truncate text-sm">{client ? getClientDisplayName(client) : "Client inconnu"}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Receipt className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="text-xs text-muted-foreground truncate">{invoice.numero} • {safeFormat(invoice.dateEmission)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-foreground text-sm">{invoice.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</div>
                                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border mt-1", getStatusColor(invoice.statut))}>{invoice.statut}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {recentActivity.recentInvoices.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucune facture sur cette période</div>}
                    </div>
                </div>

                {/* Recent Quotes */}
                <div className="glass-card rounded-2xl overflow-hidden min-h-[300px]">
                    <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Devis Récents</h3>
                        <Link href="/devis" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Voir tout</Link>
                    </div>
                    <div className="divide-y divide-white/5">
                        {recentActivity.recentQuotes.map(quote => {
                            const client = clients.find(c => c.id === quote.clientId);
                            return (
                                <div key={quote.id} className="p-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-semibold text-foreground truncate text-sm">{client ? getClientDisplayName(client) : "Client inconnu"}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="text-xs text-muted-foreground truncate">{quote.numero} • {safeFormat(quote.dateEmission)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-foreground text-sm">{quote.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</div>
                                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border mt-1", getStatusColor(quote.statut))}>{quote.statut}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {recentActivity.recentQuotes.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucun devis sur cette période</div>}
                    </div>
                </div>
            </div>
        </div >
    );
}
