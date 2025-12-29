"use client";

import { useMemo, useState, useEffect, useRef, cloneElement, isValidElement } from "react";
// Optimized Recharts imports
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Devis } from "@/types";

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
            { name: "Gagnées", value: statusCounts.signe, color: "#10B981" }, // Emerald-500
            { name: "En Attente", value: statusCounts.attente, color: "#3B82F6" }, // Blue-500
            { name: "Refusé", value: statusCounts.refuse, color: "#EF4444" }, // Red-500
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
            <div className="h-[260px] w-[260px] relative shrink-0 [&_*]:outline-none [&_path]:outline-none">
                <ChartGuard height="100%">
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
                                cursor={{ fill: 'transparent' }}
                                position={{ y: 235 }}
                                wrapperStyle={{ outline: 'none' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-popover/95 backdrop-blur-sm border border-border p-2 rounded-lg shadow-lg text-xs flex items-center gap-2 transform -translate-x-1/2 left-1/2 relative">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                                                <span className="font-medium text-popover-foreground">{data.name}:</span>
                                                <span className="font-mono font-bold text-popover-foreground">
                                                    {(data.value || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartGuard>
                {/* Center Text displaying Signed Amount */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Signé</span>
                    <span className="text-3xl font-bold text-emerald-500">
                        {totalSigned.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div className="space-y-4 w-full max-w-[300px] min-w-0">
                {data.map((item) => {
                    if (!["Gagnées", "Brouillon", "Refusé"].includes(item.name)) return null;
                    return (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors cursor-default gap-3 min-w-0 min-h-[40px]">
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden flex-1">
                                <div className="w-4 h-4 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-base font-medium text-foreground truncate">{item.name}</span>
                            </div>
                            <span className="text-base font-semibold text-muted-foreground font-mono whitespace-nowrap flex-shrink-0">
                                {item.value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
