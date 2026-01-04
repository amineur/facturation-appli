"use client";

import { useData } from "@/components/data-provider";
import { useDashboardState } from "@/components/providers/dashboard-state-provider";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, endOfDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { safeFormat } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { BarChart3, Users, Package, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

type TabType = "clients" | "produits" | "mois";

export function MobileReports() {
    const { invoices, quotes, clients } = useData();
    const {
        reportsDateRange: dateRange,
        setReportsDateRange: setDateRange,
        reportsCustomStart: customStart,
        setReportsCustomStart: setCustomStart,
        reportsCustomEnd: customEnd,
        setReportsCustomEnd: setCustomEnd
    } = useDashboardState();

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
        const filteredInvoices = filteredData.invoices.filter(inv => ["Payée", "Envoyée", "Retard"].includes(inv.statut));
        const stats = new Map<string, { revenue: number; count: number; name: string }>();

        filteredInvoices.forEach(inv => {
            inv.items?.forEach(item => {
                if (!item.description) return;
                const rawName = item.description;
                const key = rawName.trim().toLowerCase();
                const current = stats.get(key) || { revenue: 0, count: 0, name: rawName };

                // Simplified Calc
                let lineRevenue = item.totalLigne || (Number(item.quantite) * Number(item.prixUnitaire));

                stats.set(key, {
                    revenue: current.revenue + (lineRevenue || 0),
                    count: current.count + Number(item.quantite || 0),
                    name: current.name
                });
            });
        });

        return Array.from(stats.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredData.invoices]);

    // 3. Monthly Breakdown
    const monthlyData = useMemo(() => {
        const data = new Map<string, { name: string; factures: number; devis: number }>();
        const getKey = (dateStr: string | undefined | null) => dateStr ? dateStr.substring(0, 7) : "unknown";
        const getLabel = (dateStr: string | undefined | null) => {
            if (!dateStr) return "Inconnu";
            try {
                return format(parseISO(dateStr), "MMM yy", { locale: fr });
            } catch (e) {
                return "Inconnu";
            }
        };

        // Init
        [...filteredData.invoices, ...filteredData.quotes].forEach(item => {
            const key = getKey(item.dateEmission);
            if (!data.has(key)) data.set(key, { name: getLabel(item.dateEmission), factures: 0, devis: 0 });
        });

        filteredData.invoices.forEach(inv => {
            if (inv.statut === "Payée") {
                const key = getKey(inv.dateEmission);
                if (data.has(key)) data.get(key)!.factures += inv.totalTTC;
            }
        });
        filteredData.quotes.forEach(q => {
            const key = getKey(q.dateEmission);
            if (data.has(key)) data.get(key)!.devis += q.totalTTC;
        });

        return Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
    }, [filteredData]);

    return (
        <div className="p-4 space-y-6 pb-32 font-sans">
            <div>
                <h1 className="text-2xl font-bold">Rapports</h1>
                <p className="text-sm text-muted-foreground">Analyses du {safeFormat(filteredData.start, "d MMM")} au {safeFormat(filteredData.end, "d MMM")}</p>
            </div>

            {/* KPI Cards (New Audit Requirement) */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Chiffre d'Affaires</p>
                    <p className="text-lg font-bold">
                        {filteredData.invoices.filter(i => i.statut === "Payée").reduce((acc, i) => acc + i.totalTTC, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">En Attente</p>
                    <p className="text-lg font-bold text-blue-500">
                        {filteredData.invoices.filter(i => ["Envoyée", "Envoyé", "Retard"].includes(i.statut)).reduce((acc, i) => acc + i.totalTTC, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Volume Devis</p>
                    <p className="text-lg font-bold text-purple-500">
                        {filteredData.quotes.length} <span className="text-xs text-muted-foreground font-normal">/ {filteredData.quotes.reduce((acc, q) => acc + q.totalTTC, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</span>
                    </p>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Clients Actifs</p>
                    <p className="text-lg font-bold text-orange-500">
                        {new Set([...filteredData.invoices, ...filteredData.quotes].map(i => i.clientId)).size}
                    </p>
                </div>
            </div>

            {/* Date Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {[
                    { key: "month", label: "Ce Mois" },
                    { key: "3months", label: "3 Mois" },
                    { key: "total", label: "Total" },
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
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-muted/30 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab("clients")}
                    className={cn("py-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center gap-1", activeTab === "clients" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/50")}
                >
                    <Users className="h-4 w-4" /> Top Clients
                </button>
                <button
                    onClick={() => setActiveTab("produits")}
                    className={cn("py-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center gap-1", activeTab === "produits" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/50")}
                >
                    <Package className="h-4 w-4" /> Top Produits
                </button>
                <button
                    onClick={() => setActiveTab("mois")}
                    className={cn("py-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center gap-1", activeTab === "mois" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/50")}
                >
                    <Calendar className="h-4 w-4" /> Evolution
                </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
                {activeTab === "clients" && (
                    <div className="space-y-3">
                        {topClients.map((item, idx) => (
                            <div key={idx} className="bg-card p-4 rounded-xl border border-border/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                        #{idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{item.client?.nom}</p>
                                        <p className="text-xs text-muted-foreground">{item.count} factures</p>
                                    </div>
                                </div>
                                <p className="font-bold text-sm">{item.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                            </div>
                        ))}
                        {topClients.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée</p>}
                    </div>
                )}

                {activeTab === "produits" && (
                    <div className="space-y-3">
                        {topProducts.map((item, idx) => (
                            <div key={idx} className="bg-card p-4 rounded-xl border border-border/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-xs">
                                        #{idx + 1}
                                    </div>
                                    <div className="min-w-0 max-w-[150px]">
                                        <p className="font-semibold text-sm truncate">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.count} vendus</p>
                                    </div>
                                </div>
                                <p className="font-bold text-sm text-right">{item.revenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                            </div>
                        ))}
                        {topProducts.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée</p>}
                    </div>
                )}

                {activeTab === "mois" && (
                    <div className="space-y-4">
                        <div className="h-[200px] w-full bg-card p-4 rounded-xl border border-border/50">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'black', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                                        itemStyle={{ padding: 0 }}
                                    />
                                    <Bar dataKey="factures" fill="#10b981" radius={[4, 4, 0, 0]} name="CA Facturé" />
                                    <Bar dataKey="devis" fill="#a855f7" radius={[4, 4, 0, 0]} name="Vol. Devis" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {monthlyData.reverse().map((item, idx) => (
                            <div key={idx} className="bg-card p-4 rounded-xl border border-border/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold capitalize">{item.name}</span>
                                    <span className="text-xs bg-muted px-2 py-1 rounded">Total CA</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Facturé</p>
                                        <p className="font-bold text-lg text-emerald-500">{item.factures.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Devis</p>
                                        <p className="font-medium text-purple-500">{item.devis.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {monthlyData.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
