import { Facture, Devis } from "@/types";

/**
 * Generates the next invoice number based on existing invoices
 * Format: YYYYNNNN (e.g., 20180258, 20180259, ...)
 */
export function generateNextInvoiceNumber(existingInvoices: Facture[]): string {
    if (existingInvoices.length === 0) {
        return "20180258"; // Starting number
    }

    // Extract all numeric invoice numbers
    const numericInvoices = existingInvoices
        .map(inv => inv.numero)
        .filter(num => /^\d{8}$/.test(num)) // Only 8-digit numbers
        .map(num => parseInt(num, 10))
        .filter(num => !isNaN(num));

    if (numericInvoices.length === 0) {
        return "20180258"; // Starting number if no valid numeric invoices found
    }

    // Find the highest number and increment
    const maxNumber = Math.max(...numericInvoices);
    const nextNumber = maxNumber + 1;

    // Ensure it's 8 digits
    return nextNumber.toString().padStart(8, "0");
}

/**
 * Generates the next quote number based on existing quotes
 * Format: DEVYYYYNNNN (e.g., DEV20180001, DEV20180002, ...)
 */
export function generateNextQuoteNumber(existingQuotes: Devis[]): string {
    const currentYear = new Date().getFullYear().toString().substring(2); // "25" for 2025
    const startNumber = parseInt(`${currentYear}00001`); // 2500001, wait, user wants 8 digits? 22120349 is 8 digits.
    // 25 000001 is 8 digits.

    // Extract all numeric quote numbers that match the 8-digit pattern
    const numericQuotes = existingQuotes
        .map(quote => quote.numero)
        .filter(num => /^\d{8}$/.test(num))
        .map(num => parseInt(num, 10))
        .filter(num => !isNaN(num));

    if (numericQuotes.length === 0) {
        return `${currentYear}010001`; // Start at YY + 01 + 0001 -> 25010001
    }

    // Find the highest number and increment
    const maxNumber = Math.max(...numericQuotes);
    const nextNumber = maxNumber + 1;

    return nextNumber.toString();
}
