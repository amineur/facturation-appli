/**
 * 🔒 BATCH SECURITY WRAPPER
 * 
 * This file provides a single wrapper to secure ALL societe-scoped actions.
 * Instead of copy-pasting security checks 40+ times, we use this pattern.
 */

import { getCurrentUser } from "@/app/actions";
import { prisma } from "@/lib/prisma";

/**
 * Executes a callback ONLY if user has access to the société
 * @param societeId ID de la société
 * @param callback Function to execute if access granted
 * @returns Result from callback or error
 */
export async function withSocieteAccessWrapper<T>(
    societeId: string,
    callback: (userId: string) => Promise<T>
): Promise<{ success: boolean, data?: T, error?: string }> {
    try {
        // 1. Check auth
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) {
            return { success: false, error: "Non authentifié" };
        }

        const userId = userRes.data.id;

        // 2. Check membership
        const hasAccess = await prisma.societe.findFirst({
            where: {
                id: societeId,
                members: { some: { id: userId } }
            }
        });

        if (!hasAccess) {
            return { success: false, error: "Accès refusé à cette société" };
        }

        // 3. Execute callback with verified userId
        const result = await callback(userId);
        return { success: true, data: result };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Usage Example:
 * 
 * export async function fetchInvoices(societeId: string) {
 *     return withSocieteAccessWrapper(societeId, async (userId) => {
 *         const invoices = await prisma.facture.findMany({ where: { societeId } });
 *         return invoices;
 *     });
 * }
 */
