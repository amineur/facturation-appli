
import { Facture, Devis } from "@/types";
import { isWithinInterval, parseISO, startOfDay, isBefore, isAfter, format } from "date-fns";

export interface DashboardMetrics {
    caPeriod: number;
    draftPeriod: number;
    overdueGlobal: number;
    overdueCountGlobal: number;
    overduePeriod: number;
    overdueCountPeriod: number;
    dueSoonAmount: number;
    dueSoonCount: number;
    invoiceCountPeriod: number;
    quoteCountPeriod: number;
    clientCountTotal: number;
    chartData: { name: string; value: number; color: string }[];
    totalRevenue: number;
}

interface ComputeMetricsParams {
    invoices: Facture[]; // Already filtered by period
    quotes: Devis[];
    globalInvoices: Facture[];
    globalClientsCount: number;
    dateStart?: Date;
    dateEnd?: Date;
}

export function computeDashboardMetrics({
    invoices,
    quotes,
    globalInvoices,
    globalClientsCount,
    dateStart,
    dateEnd
}: ComputeMetricsParams): DashboardMetrics {
    const todayStart = startOfDay(new Date());

    // 1. Period Metrics (Revenue & Draft)
    const caPeriod = invoices
        .filter(inv => inv.statut === "Payée")
        .reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);

    const draftPeriod = invoices
        .filter(inv => inv.statut === "Brouillon" || inv.statut === "Envoyée")
        .reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);

    // 2. Period Retard Logic (The requested Change)
    // Definition: Issued in Period AND Overdue AND Not Paid
    // Since 'invoices' is already filtered by 'dateEmission' in Period, we just check status/date.
    const overduePeriodInvoices = invoices.filter(inv => {
        // Exclude handled
        if (inv.statut === "Payée" || inv.statut === "Annulée") return false;

        // Explicit Retard
        if (inv.statut === "Retard") return true;

        // Check Due Date
        if (inv.echeance) {
            const dueDate = startOfDay(parseISO(inv.echeance));
            return isBefore(dueDate, todayStart);
        }
        return false;
    });

    const overduePeriod = overduePeriodInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
    const overdueCountPeriod = overduePeriodInvoices.length;

    // 3. Global Metrics (For Alerts or Context)
    const overdueGlobalInvoices = globalInvoices.filter(inv => {
        if (inv.statut === "Payée" || inv.statut === "Annulée") return false;
        if (inv.statut === "Retard") return true;
        if (inv.echeance) {
            const dueDate = startOfDay(parseISO(inv.echeance));
            return isBefore(dueDate, todayStart);
        }
        return false;
    });
    const overdueGlobal = overdueGlobalInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
    const overdueCountGlobal = overdueGlobalInvoices.length;

    // Due Soon
    const dueSoonInvoices = globalInvoices.filter(inv => {
        if (inv.statut === "Payée" || inv.statut === "Annulée" || inv.statut === "Retard") return false;
        if (!inv.echeance) return false;
        const dueDate = startOfDay(parseISO(inv.echeance));
        const diffTime = dueDate.getTime() - todayStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
    });
    const dueSoonAmount = dueSoonInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
    const dueSoonCount = dueSoonInvoices.length;

    // 4. Debug Logging
    if (process.env.NODE_ENV === 'development' && dateStart) {
        console.groupCollapsed(`[DASHBOARD_METRICS] ${dateStart ? format(dateStart, 'yyyy-MM-dd') : 'Total'} -> ${dateEnd ? format(dateEnd, 'yyyy-MM-dd') : 'Now'} `);
        console.log("Invoices in Period:", invoices.length);
        console.log("Payé Period:", caPeriod);
        console.log("Retard Period (List):", overduePeriodInvoices.map(i => ({ id: i.id, due: i.echeance, amount: i.totalTTC })));
        console.log("Retard Period Total:", overduePeriod);
        console.groupEnd();
    }

    // 5. Chart Data Construction (Using Period Retard)
    const chartData = [
        { name: "Payé (Période)", value: caPeriod, color: "#10B981" },
        { name: "Retard (Période)", value: overduePeriod, color: "#EF4444" },
        { name: "Brouillon (Période)", value: draftPeriod, color: "#94A3B8" }
    ].filter(item => item.value > 0);

    return {
        caPeriod,
        draftPeriod,
        overdueGlobal,
        overdueCountGlobal,
        overduePeriod,
        overdueCountPeriod,
        dueSoonAmount,
        dueSoonCount,
        invoiceCountPeriod: invoices.length,
        quoteCountPeriod: quotes.length,
        clientCountTotal: globalClientsCount,
        chartData,
        totalRevenue: caPeriod
    };
}

