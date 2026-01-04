import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Safely formats a date string. Returns a fallback string if the date is invalid.
 */
export function safeFormat(
    dateValue: string | Date | null | undefined,
    formatStr: string = "dd/MM/yyyy",
    options: { locale?: any; fallback?: string } = { locale: fr, fallback: "N/A" }
): string {
    if (!dateValue) return options.fallback || "N/A";

    try {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (isNaN(date.getTime())) {
            return options.fallback || "N/A";
        }
        return format(date, formatStr, { locale: options.locale || fr });
    } catch (error) {
        console.error("Error formatting date:", error, dateValue);
        return options.fallback || "N/A";
    }
}
