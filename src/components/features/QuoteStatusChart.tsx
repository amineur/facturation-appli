"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Devis } from "@/types";

interface QuoteStatusChartProps {
    quotes: Devis[]; // Filtered quotes for the period
    globalQuotes?: Devis[]; // All quotes if needed for global stats
}

export function QuoteStatusChart({ quotes, globalQuotes }: QuoteStatusChartProps) {
    // Fallback
    const allRefQuotes = globalQuotes || quotes;

    const data = useMemo(() => {
        const statusCounts = {
            signe: 0,
            attente: 0,
            refuse: 0,
            brouillon: 0,
        };

        // Aggregation Logic for Quotes
        quotes.forEach((q) => {
            const total = q.totalTTC || 0;
            // Cast to string to handle potential status variations not in strict enum
            const status = q.statut as string;

            switch (status) {
                case "Signé":
                case "Accepté":
                case "Facturé": // Converted quotes count as succesful
                case "Converti":
                    statusCounts.signe += total;
                    break;
                case "Envoyé":
                case "Envoyée":
                    statusCounts.attente += total;
                    break;
                case "Refusé":
                case "Perdu":
                    statusCounts.refuse += total;
                    break;
                case "Brouillon":
                    statusCounts.brouillon += total;
                    break;
                default:
                    statusCounts.brouillon += total;
            }
        });

        // Mapping to Chart Data
        return [
            { name: "Signé/Gagné", value: statusCounts.signe, color: "#10B981" }, // Emerald-500
            { name: "En Attente", value: statusCounts.attente, color: "#3B82F6" }, // Blue-500
            { name: "Refusé/Perdu", value: statusCounts.refuse, color: "#EF4444" }, // Red-500
            { name: "Brouillon", value: statusCounts.brouillon, color: "#94A3B8" }, // Slate-400
        ].filter(item => item.value > 0);
    }, [quotes]);

    const totalSigned = useMemo(() => {
        return quotes
            .filter(q => ["Signé", "Accepté", "Facturé", "Converti"].includes(q.statut as string))
            .reduce((acc, curr) => acc + (curr.totalTTC || 0), 0);
    }, [quotes]);

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
                {/* Center Text displaying Signed Amount */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Signé</span>
                    <span className="text-3xl font-bold text-emerald-500">
                        {totalSigned.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
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
                        <span className="text-base font-semibold text-muted-foreground font-mono pl-4">
                            {item.value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
