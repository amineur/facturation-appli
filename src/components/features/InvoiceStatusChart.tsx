"use client";

import { useMemo, useState, useEffect, useRef, cloneElement, isValidElement } from "react";
// Optimized Recharts imports
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Facture } from "@/types";

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

// ... imports ...

interface InvoiceStatusChartProps {
    invoices?: Facture[]; // kept for compatibility if needed
    globalInvoices?: Facture[];
    chartData?: { name: string; value: number; color: string }[];
    totalOverdue?: number;
}

export function InvoiceStatusChart({ invoices, globalInvoices, chartData, totalOverdue }: InvoiceStatusChartProps) {

    // Use passed data provided by computeDashboardMetrics
    const data = useMemo(() => {
        if (chartData) return chartData;
        // Legacy fallback (should not be reached if parent is updated)
        return [];
    }, [chartData]);

    const displayOverdue = totalOverdue !== undefined ? totalOverdue : 0;

    // Legacy logic removed to enforce centralization.
    // If data is empty, logic below handles it.

    if (data.length === 0) {
        return <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>;
    }

    return (
        <div className="flex flex-col md:flex-row items-center justify-around gap-8 w-full px-4 md:px-12 min-w-0">
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
                                                    {(data.amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
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
                {/* Center Text displaying Overdue Amount */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Retard</span>
                    <span className="text-3xl font-bold text-red-500">
                        {displayOverdue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div className="space-y-4 w-full md:max-w-[300px] min-w-0">
                {data.map((item) => {
                    if (!["Payées", "Brouillon"].includes(item.name)) return null;
                    return (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors cursor-default gap-3 min-w-0 min-h-[40px]">
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden flex-1">
                                <div className="w-4 h-4 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-sm md:text-base font-medium text-foreground truncate">{item.name}</span>
                            </div>
                            {/* Display only amount */}
                            <span className="text-sm md:text-base font-semibold text-foreground font-mono whitespace-nowrap flex-shrink-0">
                                {(item as any).amount?.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) || '0 €'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

