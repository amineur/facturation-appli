"use client";

import { useMemo, useState, useEffect, useRef, cloneElement, isValidElement } from "react";
import { useData } from "@/components/data-provider";
import { useDashboardState } from "@/components/providers/dashboard-state-provider";
import { TrendingUp, FileText, Users, DollarSign, BarChart3, Calendar, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts";
import { format, subMonths, startOfYear, isWithinInterval, parseISO, endOfDay, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

type DateRange = "month" | "3months" | "custom" | "total";
type TabType = "clients" | "produits" | "mois";

// Robust Guard to prevent Recharts from rendering with invalid dimensions
// Injects exact dimensions to bypass Recharts auto-measurement which fails in some contexts
const ChartGuard = ({ children, height = 350 }: { children: React.ReactNode, height?: number | string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                } else {
                    setDimensions(null);
                }
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div ref={containerRef} style={{ width: '100%', height: height, minWidth: 0 }} className="w-full min-w-0">
            {dimensions && isValidElement(children) ?
                cloneElement(children as React.ReactElement<any>, { width: dimensions.width, height: dimensions.height })
                : <div style={{ height: '100%', width: '100%' }} />
            }
        </div>
    );
};

export default function RapportsPage() {
    const { invoices, quotes, clients } = useData();

    // -- State --
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const {
        reportsDateRange: dateRange,
        setReportsDateRange: setDateRange,
        reportsCustomStart: customStart,
        setReportsCustomStart: setCustomStart,
        reportsCustomEnd: customEnd,
        setReportsCustomEnd: setCustomEnd
    } = useDashboardState();

    // Local state for Tabs only
    const [activeTab, setActiveTab] = useState<TabType>("clients");

    // -- Filtering Logic --
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
            // custom or fallback
            if (customStart && customEnd) {
                start = startOfDay(parseISO(customStart));
                end = endOfDay(parseISO(customEnd));
            }
        }

        const filterDate = (dateStr: string | undefined | null) => {
            if (!dateStr) return false;
            try {
                const date = parseISO(dateStr);
                return isWithinInterval(date, { start, end });
            } catch (e) {
                return false;
            }
        };

        return {
            invoices: invoices.filter(inv => filterDate(inv.dateEmission)),
            quotes: quotes.filter(q => filterDate(q.dateEmission)),
            start,
            end
        };
    }, [invoices, quotes, dateRange, customStart, customEnd]);

    // Update active state when inputs change
    const handleDateChange = (type: 'start' | 'end', value: string) => {
        setDateRange("custom");
        if (type === 'start') setCustomStart(value);
        else setCustomEnd(value);
    };

    // -- Metrics Calculation --
    const metrics = useMemo(() => {
        const { invoices: filteredInvoices, quotes: filteredQuotes } = filteredData;

        const paidInvoices = filteredInvoices.filter(inv => inv.statut === "Payée");
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

        const pendingInvoices = filteredInvoices.filter(inv => inv.statut === "Envoyée" || inv.statut === "Retard");
        const pendingRevenue = pendingInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

        const totalQuotesValue = filteredQuotes.reduce((sum, q) => sum + q.totalTTC, 0);

        const acceptedQuotes = filteredQuotes.filter(q => q.statut === "Accepté" || q.statut === "Converti");
        const conversionRate = filteredQuotes.length > 0 ? (acceptedQuotes.length / filteredQuotes.length) * 100 : 0;

        const activeClientIds = new Set(filteredInvoices.map(inv => inv.clientId));

        return {
            totalRevenue,
            pendingRevenue,
            totalQuotesValue,
            conversionRate,
            activeClientsCount: activeClientIds.size,
            totalInvoices: filteredInvoices.length,
            totalPaidInvoices: paidInvoices.length,
            totalQuotes: filteredQuotes.length
        };
    }, [filteredData]);

    // -- Aggregations --

    // 1. Top Clients
    const topClients = useMemo(() => {
        const filteredInvoices = filteredData.invoices.filter(inv => inv.statut === "Payée");
        const stats = new Map<string, { revenue: number; count: number }>();

        filteredInvoices.forEach(inv => {
            const current = stats.get(inv.clientId) || { revenue: 0, count: 0 };
            stats.set(inv.clientId, {
                revenue: current.revenue + inv.totalTTC,
                count: current.count + 1
            });
        });

        return Array.from(stats.entries())
            .map(([id, stat]) => ({
                client: clients.find(c => c.id === id),
                ...stat
            }))
            .filter(i => i.client)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredData.invoices, clients]);

    // 2. Top Products
    const topProducts = useMemo(() => {
        // Include Billed invoices (Payée, Envoyée, Retard)
        const filteredInvoices = filteredData.invoices.filter(inv => ["Payée", "Envoyée", "Retard"].includes(inv.statut));

        // Map: NormalizedKey -> { revenue, count, displayName }
        const stats = new Map<string, { revenue: number; count: number; name: string }>();

        filteredInvoices.forEach(inv => {
            inv.items?.forEach(item => { // Safe access
                if (!item.description) return;

                const rawName = item.description;
                const key = rawName.trim().toLowerCase(); // Normalize to merge "Produit A " and "produit A"

                const current = stats.get(key) || { revenue: 0, count: 0, name: rawName };

                // Robust revenue calculation
                let lineRevenue = item.totalLigne;
                if (!lineRevenue && lineRevenue !== 0) {
                    const parseVal = (v: any) => {
                        if (typeof v === 'number') return v;
                        if (typeof v === 'string') return parseFloat(v.replace(',', '.')) || 0;
                        return 0;
                    };
                    const q = parseVal(item.quantite);
                    const p = parseVal(item.prixUnitaire);
                    lineRevenue = q * p;
                }

                // Robust quantity calculation
                const qty = typeof item.quantite === 'number' ? item.quantite : parseFloat(String(item.quantite || 0));

                stats.set(key, {
                    revenue: current.revenue + (typeof lineRevenue === 'number' ? lineRevenue : 0),
                    count: current.count + (isNaN(qty) ? 0 : qty),
                    name: current.name // Keep first encountered display name
                });
            });
        });

        return Array.from(stats.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredData.invoices]);

    // 3. Monthly Breakdown (Chart Data)
    const monthlyData = useMemo(() => {
        const data = new Map<string, { name: string; factures: number; devis: number }>();

        // Helper to get key "YYYY-MM"
        const getKey = (dateStr: string | undefined | null) => dateStr ? dateStr.substring(0, 7) : "unknown";
        const getLabel = (dateStr: string | undefined | null) => {
            if (!dateStr) return "Inconnu";
            try {
                return format(parseISO(dateStr), "MMMM yyyy", { locale: fr });
            } catch (e) {
                return "Inconnu";
            }
        };

        // Initialize with filtered data
        [...filteredData.invoices, ...filteredData.quotes].forEach(item => {
            const key = getKey(item.dateEmission);
            if (!data.has(key)) {
                data.set(key, { name: getLabel(item.dateEmission), factures: 0, devis: 0 });
            }
        });

        // Fill Data
        filteredData.invoices.forEach(inv => {
            if (inv.statut === "Payée") {
                const key = getKey(inv.dateEmission);
                const entry = data.get(key)!;
                entry.factures += inv.totalTTC;
            }
        });

        filteredData.quotes.forEach(q => {
            // Considering all quotes for potential volume, or just accepted? User said "Ventes", usually means realized vs potential.
            // Let's show TOTAL quote value sent vs TOTAL invoice value paid
            const key = getKey(q.dateEmission);
            if (data.has(key)) {
                data.get(key)!.devis += q.totalTTC;
            }
        });

        return Array.from(data.values()).reverse(); // Sort properly if needed, usually map iteration order is insertion order, but better to sort by date key if possible. 
        // Simple sort:
        return Array.from(data.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([_, val]) => val);

    }, [filteredData]);

    return (
        <div className="space-y-8 pb-12">
            {/* Header & Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Rapports</h2>
                    <p className="text-muted-foreground mt-1">Analyse détaillée de votre activité</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 glass-card p-1.5 rounded-xl">
                    <div className="flex bg-muted/50 rounded-lg p-1">
                        <button
                            onClick={() => {
                                setDateRange("total");
                                setCustomStart("2000-01-01"); // Start from beginning
                                setCustomEnd(format(new Date(), "yyyy-MM-dd"));
                            }}
                            className={cn(
                                "h-8 px-3 text-sm font-medium rounded-md transition-all leading-none flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                dateRange === "total"
                                    ? "bg-primary/10 text-primary shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                        >
                            3 Derniers Mois
                        </button>
                        <button
                            onClick={() => {
                                setDateRange("month");
                                setCustomStart(format(startOfMonth(new Date()), "yyyy-MM-dd"));
                                setCustomEnd(format(endOfMonth(new Date()), "yyyy-MM-dd"));
                            }}
                            className={cn(
                                "h-8 px-3 text-sm font-medium rounded-md transition-all leading-none flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                dateRange === "month"
                                    ? "bg-primary/10 text-primary shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                        >
                            Ce Mois
                        </button>
                    </div>



                    <div className="h-6 w-px bg-border hidden sm:block mx-1" />

                    <div className="flex items-center gap-2 px-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Période : Du</span>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => handleDateChange('start', e.target.value)}
                            className="bg-transparent border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px]"
                        />
                        <span className="text-sm text-muted-foreground">au</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => handleDateChange('end', e.target.value)}
                            className="bg-transparent border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px]"
                        />
                    </div>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: CA */}
                <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-muted-foreground">Chiffre d'Affaires</span>
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <DollarSign className="h-5 w-5 text-emerald-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold mb-1">
                        {metrics.totalRevenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                    </div>
                    <div className="text-xs text-emerald-500 font-medium">
                        {metrics.totalPaidInvoices} factures payées
                    </div>
                </div>

                {/* Card 2: En Attente */}
                <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-muted-foreground">En Attente</span>
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold mb-1">
                        {metrics.pendingRevenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                    </div>
                    <div className="text-xs text-blue-400 font-medium">
                        Factures non payées
                    </div>
                </div>

                {/* Card 3: Devis */}
                <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-muted-foreground">Volume Devis</span>
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-purple-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold mb-1">
                        {metrics.totalQuotesValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                    </div>
                    <div className="text-xs text-purple-400 font-medium">
                        Taux conversion : {metrics.conversionRate.toFixed(1)}%
                    </div>
                </div>

                {/* Card 4: Clients */}
                <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-muted-foreground">Clients Actifs</span>
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <Users className="h-5 w-5 text-orange-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold mb-1">
                        {metrics.activeClientsCount}
                    </div>
                    <div className="text-xs text-orange-400 font-medium">
                        Sur la période
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Evolution des Ventes
                </h3>
                <div className="h-[350px] w-full min-w-0">
                    <ChartGuard height={350}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorFactures" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                                    </linearGradient>
                                    <linearGradient id="colorDevis" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                    dx={-10}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="glass-card p-4 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl bg-slate-950/80">
                                                    <p className="text-sm font-semibold mb-3 text-foreground">{label}</p>
                                                    <div className="space-y-2">
                                                        {payload.map((entry: any, index: number) => (
                                                            <div key={index} className="flex items-center justify-between gap-8 text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                                                                        style={{ backgroundColor: entry.color === 'url(#colorFactures)' ? '#10b981' : '#8b5cf6' }}
                                                                    />
                                                                    <span className="text-muted-foreground">{entry.name}</span>
                                                                </div>
                                                                <span className="font-bold text-foreground font-mono">
                                                                    {entry.value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar
                                    dataKey="factures"
                                    name="Factures Payées"
                                    fill="url(#colorFactures)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                                <Bar
                                    dataKey="devis"
                                    name="Devis Émis"
                                    fill="url(#colorDevis)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartGuard>
                </div>
            </div>

            {/* Tabbed Detail Section */}
            <div className="glass-card rounded-xl overflow-hidden">
                <div className="border-b border-white/10">
                    <div className="flex items-center px-6">
                        <button
                            onClick={() => setActiveTab("clients")}
                            className={cn("px-4 py-4 text-sm font-medium border-b-2 transition-colors",
                                activeTab === "clients" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                        >
                            Meilleurs Clients
                        </button>
                        <button
                            onClick={() => setActiveTab("produits")}
                            className={cn("px-4 py-4 text-sm font-medium border-b-2 transition-colors",
                                activeTab === "produits" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                        >
                            Meilleurs Produits
                        </button>
                        <button
                            onClick={() => setActiveTab("mois")}
                            className={cn("px-4 py-4 text-sm font-medium border-b-2 transition-colors",
                                activeTab === "mois" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                        >
                            Meilleurs Mois
                        </button>
                    </div>
                </div>

                <div className="p-0">
                    {/* CLIENTS TAB */}
                    {activeTab === "clients" && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-muted-foreground">
                                <thead className="bg-white/5 text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Rang</th>
                                        <th className="px-6 py-4 font-medium">Client</th>
                                        <th className="px-6 py-4 font-medium text-right">Chiffre d'Affaires</th>
                                        <th className="px-6 py-4 font-medium text-right">Factures</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {topClients.map((item, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-foreground w-16">
                                                #{index + 1}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-foreground">
                                                {item.client?.nom || "Inconnu"}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-foreground">
                                                {item.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {item.count}
                                            </td>
                                        </tr>
                                    ))}
                                    {topClients.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center">Aucune donnée sur cette période</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* PRODUITS TAB */}
                    {activeTab === "produits" && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-muted-foreground">
                                <thead className="bg-white/5 text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Rang</th>
                                        <th className="px-6 py-4 font-medium">Produit / Service</th>
                                        <th className="px-6 py-4 font-medium text-right">Revenu Généré</th>
                                        <th className="px-6 py-4 font-medium text-right">Qté Vendue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {topProducts.map((item, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-foreground w-16">
                                                #{index + 1}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-foreground">
                                                {item.name}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-foreground">
                                                {item.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {item.count}
                                            </td>
                                        </tr>
                                    ))}
                                    {topProducts.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center">Aucune donnée sur cette période</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* MOIS TAB */}
                    {activeTab === "mois" && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-muted-foreground">
                                <thead className="bg-white/5 text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Rang</th>
                                        <th className="px-6 py-4 font-medium">Mois</th>
                                        <th className="px-6 py-4 font-medium text-right">CA Facturé (TTC)</th>
                                        <th className="px-6 py-4 font-medium text-right">Devis Émis (TTC)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {[...monthlyData].sort((a, b) => b.factures - a.factures).map((item, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-foreground w-16">
                                                #{index + 1}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-foreground capitalize">
                                                {item.name}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-400">
                                                {item.factures.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </td>
                                            <td className="px-6 py-4 text-right text-purple-400">
                                                {item.devis.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </td>
                                        </tr>
                                    ))}
                                    {monthlyData.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center">Aucune donnée sur cette période</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
