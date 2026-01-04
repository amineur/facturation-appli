"use client";

import { useData } from "@/components/data-provider";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, endOfDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, FileText, Users, TrendingUp, ArrowUpRight, AlertTriangle, Clock, Calendar, BarChart3, Package, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDashboardState } from "@/components/providers/dashboard-state-provider";
import { BarChart, Bar, ResponsiveContainer, Cell, PieChart, Pie, XAxis, Tooltip } from "recharts";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { safeFormat } from "@/lib/date-utils";

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

    // -- 6. Data Aggregations (From Reports) --
    // Top Clients
    const topClients = useMemo(() => {
        const filteredInvoices = filteredData.invoices.filter(inv => inv.statut === "Payée");
        const stats = new Map<string, { revenue: number; count: number }>();
        filteredInvoices.forEach(inv => {
            const current = stats.get(inv.clientId) || { revenue: 0, count: 0 };
            stats.set(inv.clientId, { revenue: current.revenue + inv.totalTTC, count: current.count + 1 });
        });
        return Array.from(stats.entries()).map(([id, stat]) => ({ client: clients.find(c => c.id === id), ...stat })).filter(i => i.client)
            .sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [filteredData.invoices, clients]);

    // Top Products
    const topProducts = useMemo(() => {
        // Includes Sent/Overdue to show potential
        const filteredInvoices = filteredData.invoices.filter(inv => ["Payée", "Envoyée", "Retard"].includes(inv.statut));
        const stats = new Map<string, { revenue: number; count: number; name: string }>();
        filteredInvoices.forEach(inv => {
            inv.items?.forEach(item => {
                if (!item.description) return;
                const key = item.description.trim().toLowerCase();
                const current = stats.get(key) || { revenue: 0, count: 0, name: item.description };
                let lineRevenue = item.totalLigne || (Number(item.quantite) * Number(item.prixUnitaire));
                stats.set(key, { revenue: current.revenue + (lineRevenue || 0), count: current.count + Number(item.quantite || 0), name: current.name });
            });
        });
        return Array.from(stats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [filteredData.invoices]);

    // Monthly Evolution
    const monthlyData = useMemo(() => {
        const data = new Map<string, { name: string; factures: number; devis: number }>();
        const getKey = (dateStr: string | undefined | null) => dateStr ? dateStr.substring(0, 7) : "unknown";
        [...filteredData.invoices, ...filteredData.quotes].forEach(item => {
            const key = getKey(item.dateEmission);
            if (!data.has(key) && item.dateEmission) data.set(key, { name: format(parseISO(item.dateEmission), "MMM", { locale: fr }), factures: 0, devis: 0 });
        });
        filteredData.invoices.filter(i => i.statut === "Payée").forEach(inv => { const k = getKey(inv.dateEmission); if (data.has(k)) data.get(k)!.factures += inv.totalTTC; });
        filteredData.quotes.forEach(q => { const k = getKey(q.dateEmission); if (data.has(k)) data.get(k)!.devis += q.totalTTC; });
        return Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
    }, [filteredData]);

    const totalOverdueAmount = useMemo(() => {
        return filteredData.invoices.filter(i => i.statut === "Retard").reduce((s, i) => s + i.totalTTC, 0);
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

    const [activeTab, setActiveTab] = useState<"overview" | "evolution" | "clients" | "produits">("overview");
    const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

    return (
        <div className="p-4 space-y-6 pb-32 font-sans">
            {/* Header & Date Filters */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
                        <p className="text-sm text-muted-foreground">Activité du {format(filteredData.start, "d MMM", { locale: fr })} au {format(filteredData.end, "d MMM", { locale: fr })}</p>
                    </div>
                </div>

                {/* Date Filter Trigger (Modern Pill) */}
                <button
                    onClick={() => setIsDateFilterOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-background/60 backdrop-blur-md border border-border/50 rounded-full text-sm font-medium shadow-sm active:scale-95 transition-all w-fit"
                >
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>
                        {dateRange === "month" && "Ce mois"}
                        {dateRange === "3months" && "3 derniers mois"}
                        {dateRange === "total" && "Total"}
                        {dateRange === "custom" && "Période personnalisée"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                </button>
            </div>

            {/* Date Filter Bottom Sheet */}
            {isDateFilterOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] animate-in fade-in"
                        onClick={() => setIsDateFilterOpen(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300 p-6 space-y-6">
                        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />
                        <h3 className="text-lg font-bold text-center">Période</h3>

                        <div className="space-y-2">
                            {[
                                { key: "month", label: "Ce mois", sub: "Période actuelle" },
                                { key: "3months", label: "3 derniers mois", sub: "Vision trimestrielle" },
                                { key: "total", label: "Depuis le début", sub: "Tout l'historique" },
                            ].map((opt) => (
                                <button
                                    key={opt.key}
                                    onClick={() => {
                                        setDateRange(opt.key as any);
                                        setIsDateFilterOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98]",
                                        dateRange === opt.key
                                            ? "bg-primary/5 border-primary text-primary"
                                            : "bg-white border-border/50 text-foreground hover:bg-muted/50"
                                    )}
                                >
                                    <div className="text-left">
                                        <p className="font-semibold">{opt.label}</p>
                                        <p className="text-xs text-muted-foreground">{opt.sub}</p>
                                    </div>
                                    {dateRange === opt.key && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </button>
                            ))}

                            {/* Custom Option */}
                            <div className={cn("rounded-xl border transition-all overflow-hidden", dateRange === "custom" ? "border-primary bg-primary/5" : "border-border/50 bg-white")}>
                                <button
                                    onClick={() => setDateRange("custom")}
                                    className="w-full flex items-center justify-between p-4 text-left"
                                >
                                    <div>
                                        <p className={cn("font-semibold", dateRange === "custom" && "text-primary")}>Personnalisé</p>
                                        <p className="text-xs text-muted-foreground">Choisir des dates</p>
                                    </div>
                                    {dateRange === "custom" && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </button>

                                {dateRange === "custom" && (
                                    <div className="px-4 pb-4 pt-0 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground ml-1">Du</label>
                                            <input
                                                type="date"
                                                value={customStart || ""}
                                                onChange={(e) => setCustomStart(e.target.value)}
                                                className="w-full bg-white border border-border/50 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground ml-1">Au</label>
                                            <input
                                                type="date"
                                                value={customEnd || ""}
                                                onChange={(e) => setCustomEnd(e.target.value)}
                                                className="w-full bg-white border border-border/50 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => setIsDateFilterOpen(false)}
                            className="w-full py-4 text-center font-semibold text-primary active:scale-95 transition-transform"
                        >
                            Fermer
                        </button>
                    </div>
                </>
            )}


            {/* Alerts Section (Only if issues exist) */}
            {
                (alerts.overdue.length > 0 || alerts.imminent.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                        {alerts.overdue.length > 0 && (
                            <div className="col-span-2 sm:col-span-1 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
                                <div>
                                    <p className="text-xs font-medium text-red-500 uppercase tracking-wider">Retard</p>
                                    <p className="font-bold text-foreground">{alerts.overdue.length} Factures</p>
                                    <p className="text-xs text-red-400/80">{alerts.overdue.reduce((s, i) => s + i.totalTTC, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                                </div>
                            </div>
                        )}
                        {alerts.imminent.length > 0 && (
                            <div className="col-span-2 sm:col-span-1 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0"><Clock className="h-5 w-5 text-orange-500" /></div>
                                <div>
                                    <p className="text-xs font-medium text-orange-500 uppercase tracking-wider">Imminent</p>
                                    <p className="font-bold text-foreground">{alerts.imminent.length} Factures</p>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Main Tabs Navigation */}
            <div className="grid grid-cols-4 gap-1 bg-muted/30 p-1 rounded-xl">
                <button onClick={() => setActiveTab("overview")} className={cn("py-2 text-[10px] font-medium rounded-lg transition-colors flex flex-col items-center gap-1", activeTab === "overview" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}>
                    <TrendingUp className="h-4 w-4" /> Vue
                </button>
                <button onClick={() => setActiveTab("evolution")} className={cn("py-2 text-[10px] font-medium rounded-lg transition-colors flex flex-col items-center gap-1", activeTab === "evolution" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}>
                    <BarChart3 className="h-4 w-4" /> Évolution
                </button>
                <button onClick={() => setActiveTab("clients")} className={cn("py-2 text-[10px] font-medium rounded-lg transition-colors flex flex-col items-center gap-1", activeTab === "clients" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}>
                    <Users className="h-4 w-4" /> Clients
                </button>
                <button onClick={() => setActiveTab("produits")} className={cn("py-2 text-[10px] font-medium rounded-lg transition-colors flex flex-col items-center gap-1", activeTab === "produits" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}>
                    <Package className="h-4 w-4" /> Produits
                </button>
            </div>

            {/* Tab Data Display */}
            <div className="min-h-[300px]">
                {activeTab === "overview" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="glass-card rounded-2xl p-4">
                                <p className="text-xs text-muted-foreground mb-1">Chiffre d'Affaires</p>
                                <p className="text-lg font-bold">{filteredData.invoices.filter(i => i.statut === "Payée").reduce((acc, i) => acc + i.totalTTC, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="glass-card rounded-2xl p-4">
                                <p className="text-xs text-muted-foreground mb-1">En Attente</p>
                                <p className="text-lg font-bold text-blue-500">{filteredData.invoices.filter(i => ["Envoyée", "Envoyé", "Retard"].includes(i.statut)).reduce((acc, i) => acc + i.totalTTC, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>

                        {/* Highlights (Best Of) - New Requirement */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground px-1">Performances</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {/* Best Month */}
                                {monthlyData.length > 0 && (() => {
                                    const bestMonth = [...monthlyData].sort((a, b) => b.factures - a.factures)[0];
                                    return (
                                        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-[var(--icon-invoice)]/10 flex items-center justify-center text-[var(--icon-invoice)]">
                                                <Calendar className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Meilleur Mois</p>
                                                <p className="font-bold capitalize">{bestMonth.name}</p>
                                                <p className="text-xs font-semibold text-[var(--icon-invoice)]">{bestMonth.factures.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Best Client */}
                                {topClients.length > 0 && (
                                    <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-[var(--icon-client)]/10 flex items-center justify-center text-[var(--icon-client)]">
                                            <Users className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Meilleur Client</p>
                                            <p className="font-bold truncate max-w-[150px]">{topClients[0].client?.nom}</p>
                                            <p className="text-xs font-semibold text-[var(--icon-client)]">{topClients[0].revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Best Product */}
                                {topProducts.length > 0 && (
                                    <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                            <Package className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Meilleur Produit</p>
                                            <p className="font-bold truncate max-w-[150px]">{topProducts[0].name}</p>
                                            <p className="text-xs font-semibold text-purple-500">
                                                {topProducts[0].count} unités • {topProducts[0].revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Distribution Chart */}
                        <div className="glass-card rounded-2xl p-4 flex flex-col items-center">
                            <div className="flex bg-white/5 rounded-lg p-1 mb-4 w-full">
                                <button onClick={() => setChartMode("factures")} className={cn("flex-1 h-8 px-3 text-sm font-medium rounded-md transition-colors", chartMode === "factures" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>Factures</button>
                                <button onClick={() => setChartMode("devis")} className={cn("flex-1 h-8 px-3 text-sm font-medium rounded-md transition-colors", chartMode === "devis" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>Devis</button>
                            </div>
                            <div className="w-full flex justify-center -ml-4">
                                {chartMode === "factures" ? (
                                    <InvoiceStatusChart invoices={filteredData.invoices} globalInvoices={[]} chartData={invoiceDistribution} totalOverdue={totalOverdueAmount} />
                                ) : (
                                    <QuoteStatusChart quotes={filteredData.quotes} globalQuotes={[]} />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "evolution" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="h-[200px] w-full glass-card p-4 rounded-xl">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: '#1E1E1E', borderRadius: '12px', border: 'none', fontSize: '12px', color: 'white', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        itemStyle={{ padding: 0 }}
                                    />
                                    <Bar dataKey="factures" fill="#10b981" radius={[4, 4, 0, 0]} name="CA Facturé" />
                                    <Bar dataKey="devis" fill="#a855f7" radius={[4, 4, 0, 0]} name="Vol. Devis" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        {monthlyData.reverse().map((item, idx) => (
                            <div key={idx} className="glass-card p-4 rounded-xl flex justify-between items-center">
                                <span className="font-bold capitalize">{item.name}</span>
                                <div className="text-right">
                                    <p className="font-bold text-[var(--icon-invoice)]">{item.factures.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                                    <p className="text-[10px] text-muted-foreground">CA Facturé</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === "clients" && (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        {topClients.map((item, idx) => (
                            <div key={idx} className="glass-card p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-[var(--icon-client)]/10 flex items-center justify-center text-[var(--icon-client)] font-bold text-xs">#{idx + 1}</div>
                                    <div>
                                        <p className="font-semibold text-sm">{item.client?.nom}</p>
                                        <p className="text-xs text-muted-foreground">{item.count} factures</p>
                                    </div>
                                </div>
                                <p className="font-bold text-sm">{item.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                            </div>
                        ))}
                        {topClients.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée</p>}
                    </div>
                )}

                {activeTab === "produits" && (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        {topProducts.map((item, idx) => (
                            <div key={idx} className="glass-card p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-xs">#{idx + 1}</div>
                                    <div className="min-w-0 max-w-[150px]">
                                        <p className="font-semibold text-sm truncate">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.count} vendus</p>
                                    </div>
                                </div>
                                <p className="font-bold text-sm text-right">{item.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                            </div>
                        ))}
                        {topProducts.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée</p>}
                    </div>
                )}
            </div>

            {/* Recent Activity (Always Visible at bottom) */}
            <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Activité Récente</h3>
                    <Link href="/factures" className="text-xs text-primary font-medium">Voir tout</Link>
                </div>
                <div className="space-y-3">
                    {recentActivity.map((item) => {
                        const client = clients.find(c => c.id === item.clientId);
                        return (
                            <Link key={item.id} href={item.type === 'invoice' ? `/factures/${item.id}` : `/devis/${item.id}`} className="flex items-center gap-4 p-4 rounded-2xl glass-card shadow-sm active:bg-accent/50 transition-colors">
                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", item.type === 'invoice' ? "bg-[var(--icon-invoice)]/10 text-[var(--icon-invoice)]" : "bg-[var(--icon-quote)]/10 text-[var(--icon-quote)]")}>
                                    {item.type === 'invoice' ? <Receipt className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{client?.nom || "Client Inconnu"}</p>
                                    <p className="text-xs text-muted-foreground">{item.numero} • {safeFormat(item.dateEmission, "d MMM")}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold">{item.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium inline-block mt-1", getStatusColor(item.statut))}>{item.statut}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div >
    );
}
