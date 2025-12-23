"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { startOfMonth, endOfDay, format } from "date-fns";

type DateRangeType = "month" | "custom" | "3months" | "total";

interface DashboardStateContextType {
    // Dashboard Specific State
    dateRange: DateRangeType;
    setDateRange: (range: DateRangeType) => void;
    customStart: string;
    setCustomStart: (date: string) => void;
    customEnd: string;
    setCustomEnd: (date: string) => void;
    chartMode: "factures" | "devis";
    setChartMode: (mode: "factures" | "devis") => void;

    // Reports Specific State
    reportsDateRange: DateRangeType;
    setReportsDateRange: (range: DateRangeType) => void;
    reportsCustomStart: string;
    setReportsCustomStart: (date: string) => void;
    reportsCustomEnd: string;
    setReportsCustomEnd: (date: string) => void;
}

const DashboardStateContext = createContext<DashboardStateContextType | undefined>(undefined);

export function DashboardStateProvider({ children }: { children: ReactNode }) {
    // Dashboard Defaults
    const [dateRange, setDateRange] = useState<DateRangeType>("month");
    const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState<string>(format(endOfDay(new Date()), "yyyy-MM-dd"));
    const [chartMode, setChartMode] = useState<"factures" | "devis">("factures");

    // Reports Defaults
    const [reportsDateRange, setReportsDateRange] = useState<DateRangeType>("month");
    const [reportsCustomStart, setReportsCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [reportsCustomEnd, setReportsCustomEnd] = useState<string>(format(endOfDay(new Date()), "yyyy-MM-dd"));

    return (
        <DashboardStateContext.Provider value={{
            dateRange, setDateRange,
            customStart, setCustomStart,
            customEnd, setCustomEnd,
            chartMode, setChartMode,

            reportsDateRange, setReportsDateRange,
            reportsCustomStart, setReportsCustomStart,
            reportsCustomEnd, setReportsCustomEnd
        }}>
            {children}
        </DashboardStateContext.Provider>
    );
}

export function useDashboardState() {
    const context = useContext(DashboardStateContext);
    if (context === undefined) {
        throw new Error("useDashboardState must be used within a DashboardStateProvider");
    }
    return context;
}
