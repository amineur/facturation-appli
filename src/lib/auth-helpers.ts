/**
 * 🔒 AUTH HELPERS - Security Layer
 * 
 * Ces helpers garantissent que TOUTES les server actions sont scoppées
 * à l'utilisateur connecté et à ses sociétés autorisées.
 * 
 * Usage:
 * - `withAuth()` : Vérifie qu'un user est connecté
 * - `withSocieteAccess()` : Vérifie que le user a accès à une société
 */

import { getCurrentUser } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { User } from "@/types";

/**
 * Vérifie qu'un utilisateur est authentifié via session serveur
 * @throws Error si non authentifié
 * @returns User authentifié
 */
export async function withAuth(): Promise<User> {
    const userRes = await getCurrentUser();

    if (!userRes.success || !userRes.data) {
        throw new Error("Non authentifié - Session invalide");
    }

    return userRes.data;
}

/**
 * Vérifie que l'utilisateur connecté a accès à la société demandée
 * @param societeId ID de la société à vérifier
 * @throws Error si accès refusé ou non authentifié
 * @returns { user, societe }
 */
export async function withSocieteAccess(societeId: string) {
    const user = await withAuth();

    // Vérifier que le user est membre de cette société
    const societe = await prisma.societe.findFirst({
        where: {
            id: societeId,
            members: {
                some: {
                    id: user.id
                }
            }
        }
    });

    if (!societe) {
        throw new Error(`Accès refusé à la société ${societeId}`);
    }

    return { user, societe };
}

/**
 * Vérifie que l'utilisateur a accès à une ressource via sa société
 * @param resourceType Type de ressource ('client', 'facture', 'devis', 'produit')
 * @param resourceId ID de la ressource
 * @throws Error si accès refusé
 * @returns { user, societeId }
 */
export async function withResourceAccess(
    resourceType: 'client' | 'facture' | 'devis' | 'produit',
    resourceId: string
) {
    const user = await withAuth();

    let resource: any = null;

    switch (resourceType) {
        case 'client':
            resource = await prisma.client.findUnique({
                where: { id: resourceId },
                select: { societeId: true }
            });
            break;
        case 'facture':
            resource = await prisma.facture.findUnique({
                where: { id: resourceId },
                select: { societeId: true }
            });
            break;
        case 'devis':
            resource = await prisma.devis.findUnique({
                where: { id: resourceId },
                select: { societeId: true }
            });
            break;
        case 'produit':
            resource = await prisma.produit.findUnique({
                where: { id: resourceId },
                select: { societeId: true }
            });
            break;
    }

    if (!resource) {
        throw new Error(`${resourceType} ${resourceId} introuvable`);
    }

    // Vérifier membership
    await withSocieteAccess(resource.societeId);

    return { user, societeId: resource.societeId };
}
