"use server";

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';
import { canAccessSociete } from './members';
import { MembershipRole } from '@prisma/client';

export async function checkDatabaseConnection() {
    console.log("Checking Database connection...");
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { success: true, message: "Connexion Base de Données (Prisma) OK !" };
    } catch (error: any) {
        console.error("Database Connection Error:", error);
        return { success: false, message: `Erreur de connexion : ${error.message}` };
    }
}

export async function fetchSocietes(): Promise<{ success: boolean, data?: any[], error?: string }> {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const societes = await prisma.societe.findMany({
            where: {
                memberships: {
                    some: {
                        userId: userRes.data.id,
                        status: 'active'
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            include: {
                memberships: {
                    where: { userId: userRes.data.id },
                    select: { role: true }
                }
            }
        });

        // Flatten logic if needed, but returning as is provides Role info
        return { success: true, data: societes };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSociete(id: string) {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, id, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const societe = await prisma.societe.findUnique({ where: { id } });
        if (!societe) return { success: false, error: "Société introuvable" };

        return { success: true, data: societe };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createSociete(nom: string, details?: any) {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Utilisateur non authentifié" };
        const userId = userRes.data.id;

        // Transactional creation: Societe + Membership (OWNER)
        const societe = await prisma.$transaction(async (tx) => {
            const newSociete = await tx.societe.create({
                data: {
                    nom,
                    adresse: details?.adresse,
                    codePostal: details?.codePostal,
                    ville: details?.ville,
                    pays: details?.pays,
                    siret: details?.siret,
                    tvaIntra: details?.tvaIntra,
                    formeJuridique: details?.formeJuridique,
                    rcs: details?.rcs,
                    email: details?.email,
                    telephone: details?.telephone,
                    siteWeb: details?.siteWeb,
                    banque: details?.banque,
                    iban: details?.iban,
                    bic: details?.bic,
                    titulaireCompte: details?.titulaireCompte,
                    logoUrl: details?.logoUrl,
                    primaryColor: details?.primaryColor,
                    // DO NOT use 'members' implicit relation
                    memberships: {
                        create: {
                            userId: userId,
                            role: MembershipRole.OWNER,
                            status: 'active'
                        }
                    }
                }
            });
            return newSociete;
        });

        // Switch user to new society
        await prisma.user.update({
            where: { id: userId },
            data: { currentSocieteId: societe.id }
        });

        return { success: true, data: societe };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSociete(societe: any) {
    if (!societe.id) return { success: false, error: "ID manquant" };

    const userRes = await getCurrentUser();
    if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

    // Strict Check: ADMIN+
    const authorized = await canAccessSociete(userRes.data.id, societe.id, MembershipRole.ADMIN);
    if (!authorized) return { success: false, error: "Droit insuffisant" };

    try {
        const { id, memberships, ...data } = societe; // Exclude memberships from update payload

        await prisma.societe.update({
            where: { id },
            data: data
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
