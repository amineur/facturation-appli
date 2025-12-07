"use client";

import { useMemo } from "react";
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
    Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
    const { invoices, quotes, clients } = useData();

    // Calculate urgent items
    const urgentData = useMemo(() => {
        const today = new Date();

        // Overdue invoices
        const overdueInvoices = invoices.filter(inv => {
            if (inv.statut === "Payée" || inv.statut === "Annulée") return false;
            const dueDate = new Date(inv.echeance);
            return dueDate < today;
        });

        // Invoices due soon (within 7 days)
        const dueSoonInvoices = invoices.filter(inv => {
            if (inv.statut === "Payée" || inv.statut === "Annulée") return false;
            const dueDate = new Date(inv.echeance);
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
        });

        // Pending quotes (Envoyé status)
        const pendingQuotes = quotes.filter(q => q.statut === "Envoyé");

        // Total amounts
        const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
        const dueSoonAmount = dueSoonInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
        const pendingQuotesAmount = pendingQuotes.reduce((sum, q) => sum + q.totalTTC, 0);

        return {
            overdueInvoices,
            dueSoonInvoices,
            pendingQuotes,
            overdueAmount,
            dueSoonAmount,
            pendingQuotesAmount
        };
    }, [invoices, quotes]);

    // Quick stats
    const stats = useMemo(() => {
        const paidInvoices = invoices.filter(inv => inv.statut === "Payée");
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

        const acceptedQuotes = quotes.filter(q => q.statut === "Accepté" || q.statut === "Facturé");

        return {
            totalRevenue,
            totalInvoices: invoices.length,
            totalQuotes: quotes.length,
            totalClients: clients.length,
            acceptedQuotes: acceptedQuotes.length
        };
    }, [invoices, quotes, clients]);

    // Recent activity (last 5 invoices and quotes)
    const recentActivity = useMemo(() => {
        const recentInvoices = [...invoices]
            .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
            .slice(0, 5);

        const recentQuotes = [...quotes]
            .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
            .slice(0, 5);

        return { recentInvoices, recentQuotes };
    }, [invoices, quotes]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Payée":
            case "Accepté":
                return "bg-emerald-500/20 text-emerald-300 border-emerald-500/20";
            case "Envoyée":
            case "Envoyé":
                return "bg-blue-500/20 text-blue-300 border-blue-500/20";
            case "Retard":
            case "Refusé":
                return "bg-red-500/20 text-red-300 border-red-500/20";
            default:
                return "bg-gray-500/20 text-gray-300 border-gray-500/20";
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Tableau de Bord</h2>
                <p className="text-muted-foreground mt-1">Vue d'ensemble de votre activité</p>
            </div>

            {/* Alerts Section */}
            {(urgentData.overdueInvoices.length > 0 || urgentData.dueSoonInvoices.length > 0) && (
                <div className="space-y-4">
                    {urgentData.overdueInvoices.length > 0 && (
                        <div className="glass-card rounded-xl p-6 border-l-4 border-red-500">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <AlertCircle className="h-6 w-6 text-red-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground">Factures en Retard</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {urgentData.overdueInvoices.length} facture(s) en retard pour un montant de{" "}
                                        <span className="font-bold text-red-500">
                                            {urgentData.overdueAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                        </span>
                                    </p>
                                    <Link
                                        href="/factures?status=Retard"
                                        className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-400 mt-2"
                                    >
                                        Voir les factures <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {urgentData.dueSoonInvoices.length > 0 && (
                        <div className="glass-card rounded-xl p-6 border-l-4 border-orange-500">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-orange-500/20 rounded-lg">
                                    <Clock className="h-6 w-6 text-orange-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground">À Échéance Prochaine</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {urgentData.dueSoonInvoices.length} facture(s) à payer dans les 7 jours pour{" "}
                                        <span className="font-bold text-orange-500">
                                            {urgentData.dueSoonAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                        </span>
                                    </p>
                                    <Link
                                        href="/factures?status=Envoyée"
                                        className="inline-flex items-center gap-1 text-sm text-orange-500 hover:text-orange-400 mt-2"
                                    >
                                        Voir les factures <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card rounded-xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Chiffre d'Affaires</span>
                        <DollarSign className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                        {stats.totalRevenue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                    </div>
                    <Link href="/rapports" className="text-xs text-blue-500 hover:text-blue-400">
                        Voir les rapports →
                    </Link>
                </div>

                <div className="glass-card rounded-xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Factures</span>
                        <Receipt className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stats.totalInvoices}</div>
                    <Link href="/factures" className="text-xs text-blue-500 hover:text-blue-400">
                        Gérer les factures →
                    </Link>
                </div>

                <div className="glass-card rounded-xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Devis</span>
                        <FileText className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stats.totalQuotes}</div>
                    <Link href="/devis" className="text-xs text-blue-500 hover:text-blue-400">
                        Gérer les devis →
                    </Link>
                </div>

                <div className="glass-card rounded-xl p-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Clients</span>
                        <Users className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stats.totalClients}</div>
                    <Link href="/clients" className="text-xs text-blue-500 hover:text-blue-400">
                        Gérer les clients →
                    </Link>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Invoices */}
                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Factures Récentes</h3>
                            <Link href="/factures" className="text-sm text-blue-500 hover:text-blue-400">
                                Voir tout
                            </Link>
                        </div>
                    </div>
                    <div className="divide-y divide-white/5">
                        {recentActivity.recentInvoices.map(invoice => {
                            const client = clients.find(c => c.id === invoice.clientId);
                            return (
                                <div key={invoice.id} className="p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2">
                                                <Receipt className="h-4 w-4 text-emerald-500 shrink-0" />
                                                <span className="font-medium text-foreground truncate">{invoice.numero}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1 truncate">{client?.nom || "Client inconnu"}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-foreground">
                                                {invoice.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </div>
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border mt-1",
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
                            <div className="p-8 text-center text-muted-foreground">
                                Aucune facture
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Quotes */}
                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Devis Récents</h3>
                            <Link href="/devis" className="text-sm text-blue-500 hover:text-blue-400">
                                Voir tout
                            </Link>
                        </div>
                    </div>
                    <div className="divide-y divide-white/5">
                        {recentActivity.recentQuotes.map(quote => {
                            const client = clients.find(c => c.id === quote.clientId);
                            return (
                                <div key={quote.id} className="p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-purple-500 shrink-0" />
                                                <span className="font-medium text-foreground truncate">{quote.numero}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1 truncate">{client?.nom || "Client inconnu"}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-foreground">
                                                {quote.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                            </div>
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border mt-1",
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
                            <div className="p-8 text-center text-muted-foreground">
                                Aucun devis
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
