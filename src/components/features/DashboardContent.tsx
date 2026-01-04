"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, parseISO, startOfDay, endOfDay, subMonths } from "date-fns";
import { useDashboardState } from "@/components/providers/dashboard-state-provider";
import { fetchDashboardMetrics } from "@/app/actions";
import { Facture, Devis, Societe } from "@/types";
import { safeFormat } from "@/lib/date-utils";

const InvoiceStatusChart = dynamic(() => import("@/components/features/InvoiceStatusChart").then(mod => mod.InvoiceStatusChart), {
    loading: () => <Skeleton className="w-full h-[300px] rounded-xl" />,
    ssr: false
});
const QuoteStatusChart = dynamic(() => import("@/components/features/QuoteStatusChart").then(mod => mod.QuoteStatusChart), {
    loading: () => <Skeleton className="w-full h-[300px] rounded-xl" />,
    ssr: false
});

interface DashboardContentProps {
    initialMetrics?: any;
    initialRecentInvoices?: any[];
    initialRecentQuotes?: any[];
    user?: any;
    societeId?: string;
}

export function DashboardContent({
    initialMetrics,
    initialRecentInvoices = [],
    initialRecentQuotes = [],
    societeId: serverSocieteId
}: DashboardContentProps) {
    const { societe, clients, quotes: globalQuotes, invoices: globalInvoices } = useData();
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const [metrics, setMetrics] = useState<any>(initialMetrics || {
        revenue: 0,
        counts: {},
        overdueAmount: 0,
        overdueCount: 0,
        dueSoonAmount: 0,
        dueSoonCount: 0
    });
    const [recentInvoices, setRecentInvoices] = useState<any[]>(initialRecentInvoices);
    const [recentQuotes, setRecentQuotes] = useState<any[]>(initialRecentQuotes);

    // If server provided data, we are "loaded". If not, we might be loading.
    // Actually, if we have initialMetrics, we are good.

    // -- Date Filter State --
    const {
        dateRange, setDateRange,
        customStart, setCustomStart,
        customEnd, setCustomEnd,
        chartMode, setChartMode
    } = useDashboardState();

    // -- Recent Activity / Mount Logic --
    const isFirstMount = useRef(true);

    // Effect to handle updates
    useEffect(() => {
        let isMounted = true;

        async function updateDashboard() {
            if (!societe?.id) return;

            // SKIP Initial Fetch if Server Context Matches Client Context
            if (isFirstMount.current) {
                isFirstMount.current = false;
                const isDefaultRange = dateRange === "month";
                // If we have initial metrics, and the society matches, and we are in default view...
                // ... we trust the server data and DO NOT fetch.
                if (initialMetrics && societe?.id === serverSocieteId && isDefaultRange) {
                    return;
                }
            }

            setIsLoadingMetrics(true);

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
            } else {
                // dateRange === 'month'
                // If this is the FIRST run and we have initialMetrics and it matches 'month' logic, 
                // AND societe matches, we could technically skip.
                // But re-fetching purely client-side ensures consistency with "client time" vs "server time" 
                // and is safer. The user won't notice a fast fetch if initial data is already there.
                // However, to prevent "blink", we only set loading if we don't have data?
                // No, we want to show loading for requested changes.
            }

            try {
                // 1. Metrics
                const res = await fetchDashboardMetrics(societe.id, { start, end });
                if (isMounted && res.success) {
                    setMetrics(res.data);
                }

                // 2. Recents - Only refetch if society changed? 
                // Recent activity is not affected by Date Range usually!
                // So strictly we should decouple them.
                // But for now, let's leave recents as is (from initial or useData logic?)
                // If society switches, we DO need to update recents.
                // We typically use 'globalInvoices' for recents.

            } catch (error) {
                console.error("Failed to fetch dashboard metrics", error);
            } finally {
                if (isMounted) setIsLoadingMetrics(false);
            }
        }

        // Only trigger update if Dependencies change.
        // On mount, if dateRange is 'month' and societe is same, we might double-fetch.
        // It's acceptable for now to ensure liveness.
        updateDashboard();

        return () => { isMounted = false; };
    }, [societe?.id, dateRange, customStart, customEnd]); // Dependencies

    // -- Derived Data --
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

    const chartData = useMemo(() => {
        if (!metrics) return [];
        return [
            { name: "Payée", value: metrics.counts["Payée"] || 0, color: "#10B981" },
            { name: "Retard", value: metrics.counts["Retard"] || 0, color: "#EF4444" },
            { name: "Brouillon", value: metrics.counts["Brouillon"] || 0, color: "#94A3B8" }
        ].filter(d => d.value > 0);
    }, [metrics]);

    // Update recents when society changes (Client side fallback)
    /* 
       Problem: We used to use globalInvoices (all loaded).
       Now we rely on initialRecentInvoices.
       If user switches society, initialRecentInvoices is STALE (belongs to old society).
       We must react to societe change and maybe fetch "Recent Lite"?
       OR rely on globalInvoices context if it updates?
       The 'useData' fetches fetchInvoicesLite on Dashboard. So 'invoices' from context WILL be updated.
       So we can fallback to 'invoices' (context) if 'societe.id !== serverSocieteId'.
    */

    // Derived Recents logic:
    // If context society == server society, prefer initialData (it's instant).
    // If context society ! = server society, use context data (it follows the switch).

    const displayInvoices = useMemo(() =>
        (societe?.id === serverSocieteId && recentInvoices.length > 0)
            ? recentInvoices
            : (globalInvoices || []).slice(0, 5),
        [societe?.id, serverSocieteId, recentInvoices, globalInvoices]
    );

    const displayQuotes = useMemo(() =>
        (societe?.id === serverSocieteId && recentQuotes.length > 0)
            ? recentQuotes
            : (globalQuotes || []).slice(0, 5),
        [societe?.id, serverSocieteId, recentQuotes, globalQuotes]
    );



    return (
        <div className="space-y-8 pb-10">
            {/* Header & Controls */}
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
                            aria-label="Date de début"
                            className="bg-transparent border border-gray-200 dark:border-white/10 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px] dark:text-white"
                        />
                        <span className="text-sm text-muted-foreground">au</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => handleDateChange('end', e.target.value)}
                            aria-label="Date de fin"
                            className="bg-transparent border border-gray-200 dark:border-white/10 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px] dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Metrics & Charts */}
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
                            <InvoiceStatusChart
                                invoices={[]}
                                globalInvoices={[]}
                                chartData={chartData}
                                totalOverdue={metrics.overdueAmount}
                            />
                        ) : (
                            <QuoteStatusChart quotes={globalQuotes} globalQuotes={globalQuotes} />
                        )}
                    </div>
                </div>

                {/* Alerts Column */}
                <div className="space-y-6">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-xs text-muted-foreground">Chiffre d'Affaires</p><p className="text-xl font-bold text-foreground">{metrics.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p></div>
                                <div><p className="text-xs text-muted-foreground">Devis</p><p className="text-xl font-bold text-foreground">{displayQuotes.length} (Récents)</p></div>
                                <div><p className="text-xs text-muted-foreground">Factures</p><p className="text-xl font-bold text-foreground">{Object.values(metrics.counts).reduce((a: any, b: any) => a + Number(b), 0) as number}</p></div>
                                <div><p className="text-xs text-muted-foreground">Clients</p><p className="text-xl font-bold text-foreground">{clients.length}</p></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Recent Invoices */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Factures Récentes</h3>
                        <Link href="/factures" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Voir tout</Link>
                    </div>
                    <div className="divide-y divide-white/5">
                        {displayInvoices.map((invoice: any) => {
                            // Use client name from invoice if available (server lite), else lookup or fallback
                            const clientName = invoice.client?.nom || clients.find(c => c.id === invoice.clientId)?.nom || "Client inconnu";
                            return (
                                <div key={invoice.id} className="p-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-semibold text-foreground truncate text-sm">{clientName}</p>
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
                        {displayInvoices.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucune facture récente</div>}
                    </div>
                </div>

                {/* Recent Quotes */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Devis Récents</h3>
                        <Link href="/devis" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Voir tout</Link>
                    </div>
                    <div className="divide-y divide-white/5">
                        {displayQuotes.map((quote: any) => {
                            const clientName = quote.client?.nom || clients.find(c => c.id === quote.clientId)?.nom || "Client inconnu";
                            return (
                                <div key={quote.id} className="p-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-semibold text-foreground truncate text-sm">{clientName}</p>
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
                        {displayQuotes.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucun devis récent</div>}
                    </div>
                </div>
            </div>
        </div >
    );
}
