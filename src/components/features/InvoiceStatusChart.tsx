"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Facture } from "@/types";

interface InvoiceStatusChartProps {
    invoices: Facture[]; // Filtered invoices for the period (Paid, Draft, etc.)
    globalInvoices?: Facture[]; // All invoices for calculating total Overdue
}

export function InvoiceStatusChart({ invoices, globalInvoices }: InvoiceStatusChartProps) {
    // Fallback if not provided, though we should provide it
    const allRefInvoices = globalInvoices || invoices;

    const data = useMemo(() => {
        const statusCounts = {
            payee: 0,
            retard: 0,
            brouillon: 0,
        };

        // 1. Calculate Period Revenue (Paid, Draft, etc.) from FILTERED 'invoices'
        invoices.forEach((inv) => {
            if (inv.statut === "Payée") {
                statusCounts.payee += inv.totalTTC;
            } else if (inv.statut === "Brouillon" || inv.statut === "Envoyée") {
                statusCounts.brouillon += inv.totalTTC;
            }
        });

        // 2. Calculate GLOBAL Overdue from 'globalInvoices'
        allRefInvoices.forEach((inv) => {
            if (inv.statut === "Retard") {
                statusCounts.retard += inv.totalTTC;
            }
            // Logic for auto-detecting overdue based on date could be added here if needed,
            // but relying on status 'Retard' is safer/cleaner if logic elsewhere sets it.
            // Assuming 'Retard' status is source of truth.
        });

        return [
            { name: "Payé (Période)", value: statusCounts.payee, color: "#10B981" }, // Emerald-500
            { name: "Global Retard", value: statusCounts.retard, color: "#EF4444" }, // Red-500
            { name: "Brouillon (Période)", value: statusCounts.brouillon, color: "#94A3B8" }, // Slate-400
        ].filter(item => item.value > 0);
    }, [invoices, allRefInvoices]);

    const totalOverdue = useMemo(() => {
        return allRefInvoices
            .filter(i => i.statut === "Retard")
            .reduce((acc, curr) => acc + curr.totalTTC, 0);
    }, [allRefInvoices]);

    if (data.length === 0) {
        return <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>;
    }

    return (
        <div className="flex flex-col md:flex-row items-center justify-around gap-8 w-full px-4 md:px-12">
            <div className="h-[260px] w-[260px] relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={85}
                            outerRadius={110}
                            paddingAngle={data.length === 1 ? 0 : 5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Text displaying Overdue Amount */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Retard</span>
                    <span className="text-3xl font-bold text-red-500">
                        {totalOverdue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div className="space-y-4 w-full max-w-[300px]">
                {data.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors cursor-default">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-base font-medium text-foreground">{item.name}</span>
                        </div>
                        {/* Added min-width to separation to prevent 'sticking' numbers */}
                        <span className="text-base font-semibold text-muted-foreground font-mono pl-4">
                            {item.value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
