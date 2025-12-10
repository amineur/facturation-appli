"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import Link from "next/link";
import {
    AlertCircle,
    Clock,
    TrendingUp,
    FileText,
    Receipt,
    Users,
    ArrowRight,
    DollarSign,
    Calendar,
    Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InvoiceStatusChart } from "@/components/features/InvoiceStatusChart";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, endOfDay, isBefore } from "date-fns";

type DateRangeType = "month" | "custom";

export default function DashboardPage() {
    const { invoices: globalInvoices, quotes, clients } = useData();

    // -- Date Filter State --
    // Default to Current Month
    const [dateRange, setDateRange] = useState<DateRangeType>("month");
    const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState<string>(format(endOfDay(new Date()), "yyyy-MM-dd"));

    // -- Filtering Logic --
    const filteredData = useMemo(() => {
        const now = new Date();
        let start = startOfMonth(now);
        let end = endOfDay(now);

        if (dateRange === "custom") {
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
            invoices: globalInvoices.filter(inv => filterDate(inv.dateEmission)),
            quotes: quotes.filter(q => filterDate(q.dateEmission)),
            start,
            end
        };
    }, [globalInvoices, quotes, dateRange, customStart, customEnd]); // Depend on globalInvoices

    // -- Derived Metrics (from filtered data) --



    const stats = useMemo(() => {
        const paidInvoices = filteredData.invoices.filter(inv => inv.statut === "Payée");
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

        return {
            totalRevenue,
            totalInvoices: filteredData.invoices.length,
            totalQuotes: filteredData.quotes.length,
            totalClients: clients.length, // Keep global count for clients
        };
    }, [filteredData, clients]);

    const urgentData = useMemo(() => {
        // Robust Date Comparison using date-fns
        const todayStart = startOfDay(new Date());

        const overdueInvoices = globalInvoices.filter(inv => {
            if (inv.statut === "Payée" || inv.statut === "Annulée") return false;

            // Explicit Retard status always counts as Overdue
            if (inv.statut === "Retard") return true;

            if (!inv.echeance) return false;

            // Parse ISO string to Date and reset time to 00:00:00
            const dueDateStart = startOfDay(parseISO(inv.echeance));

            // Strict comparison: Due Date < Today ?
            return isBefore(dueDateStart, todayStart);
        });

        const dueSoonInvoices = globalInvoices.filter(inv => {
            if (inv.statut === "Payée" || inv.statut === "Annulée" || inv.statut === "Retard") return false;
            if (!inv.echeance) return false;

            const dueDateStart = startOfDay(parseISO(inv.echeance));

            // Diff in Days
            const diffTime = dueDateStart.getTime() - todayStart.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return diffDays >= 0 && diffDays <= 7;
        });

        const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
        const dueSoonAmount = dueSoonInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

        return { overdueInvoices, dueSoonInvoices, overdueAmount, dueSoonAmount };
    }, [globalInvoices]); // Uses GLOBAL invoices from context

    const recentActivity = useMemo(() => {
        // Activity from FILTERED data
        const recentInvoices = [...filteredData.invoices]
            .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
            .slice(0, 3);

        const recentQuotes = [...filteredData.quotes]
            .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
            .slice(0, 3);

        return { recentInvoices, recentQuotes };
    }, [filteredData]);

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
                            setDateRange("month");
                            setCustomStart(format(startOfMonth(new Date()), "yyyy-MM-dd"));
                            setCustomEnd(format(endOfDay(new Date()), "yyyy-MM-dd"));
                        }}
                        className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors border",
                            dateRange === "month" ? "bg-primary/10 text-primary border-primary/20" : "border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground")}
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
                            className="bg-transparent border border-gray-200 dark:border-white/10 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px] dark:text-white"
                        />
                        <span className="text-sm text-muted-foreground">au</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => handleDateChange('end', e.target.value)}
                            className="bg-transparent border border-gray-200 dark:border-white/10 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary w-[130px] dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* --- Section 1: Chart (Top Priority) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart takes 2/3 width */}
                <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-foreground">Répartition des Factures</h3>
                        <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                            {filteredData.invoices.length} factures
                        </span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        {/* Ensure chart uses Filtered Data */}
                        <InvoiceStatusChart invoices={filteredData.invoices} globalInvoices={globalInvoices} />
                    </div>
                </div>

                {/* Alerts Column (1/3 width) - Always VISIBLE regardless of date */}
                <div className="space-y-6">
                    {/* Urgency Cards */}
                    {(urgentData.overdueInvoices.length > 0 || urgentData.dueSoonInvoices.length > 0) ? (
                        <div className="space-y-4">
                            {urgentData.overdueInvoices.length > 0 && (
                                <div className="glass-card rounded-2xl p-5 border-l-4 border-red-500">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                                            <AlertCircle className="h-6 w-6 text-red-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold text-foreground">Retard</h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                <span className="font-bold text-red-500">
                                                    {urgentData.overdueAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                </span>
                                                {" "}en retard ({urgentData.overdueInvoices.length})
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {urgentData.dueSoonInvoices.length > 0 && (
                                <div className="glass-card rounded-2xl p-5 border-l-4 border-orange-500">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-orange-500/20 rounded-lg shrink-0">
                                            <Clock className="h-6 w-6 text-orange-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold text-foreground">Échéance -7j</h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                <span className="font-bold text-orange-500">
                                                    {urgentData.dueSoonAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                                </span>
                                                {" "}à venir ({urgentData.dueSoonInvoices.length})
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[150px]">
                            <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                                <TrendingUp className="h-6 w-6 text-emerald-500" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground">Tout est à jour !</h3>
                            <p className="text-xs text-muted-foreground mt-1">Aucune alerte en attente.</p>
                        </div>
                    )}

                    {/* Quick Stats Summary Box */}
                    <div className="glass-card rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Résumé Période</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Chiffre d'Affaires</p>
                                <p className="text-xl font-bold text-foreground">
                                    {stats.totalRevenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Devis</p>
                                <p className="text-xl font-bold text-foreground">{stats.totalQuotes}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Factures</p>
                                <p className="text-xl font-bold text-foreground">{stats.totalInvoices}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Clients Total</p>
                                <p className="text-xl font-bold text-foreground">{stats.totalClients}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 2: Recent Activity Lists --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Recent Invoices */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Factures Récentes</h3>
                        <Link href="/factures" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                            Voir tout
                        </Link>
                    </div>
                    <div className="divide-y divide-white/5">
                        {recentActivity.recentInvoices.map(invoice => {
                            const client = clients.find(c => c.id === invoice.clientId);
                            return (
                                <div key={invoice.id} className="p-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            {/* Client Name First & Bold */}
                                            <p className="font-semibold text-foreground truncate text-sm">{client?.nom || "Client inconnu"}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Receipt className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {invoice.numero} • {format(new Date(invoice.dateEmission), "dd/MM/yyyy")}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-foreground text-sm">
                                                {invoice.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </div>
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border mt-1",
                                                getStatusColor(invoice.statut)
                                            )}>
                                                {invoice.statut}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {recentActivity.recentInvoices.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                Aucune facture sur cette période
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Quotes */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Devis Récents</h3>
                        <Link href="/devis" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                            Voir tout
                        </Link>
                    </div>
                    <div className="divide-y divide-white/5">
                        {recentActivity.recentQuotes.map(quote => {
                            const client = clients.find(c => c.id === quote.clientId);
                            return (
                                <div key={quote.id} className="p-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-semibold text-foreground truncate text-sm">{client?.nom || "Client inconnu"}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {quote.numero} • {format(new Date(quote.dateEmission), "dd/MM/yyyy")}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-foreground text-sm">
                                                {quote.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </div>
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border mt-1",
                                                getStatusColor(quote.statut)
                                            )}>
                                                {quote.statut}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {recentActivity.recentQuotes.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                Aucun devis sur cette période
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
