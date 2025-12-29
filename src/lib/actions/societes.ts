"use server";

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';

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
                members: {
                    some: {
                        id: userRes.data.id
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, data: societes };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSociete(id: string) {
    try {
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

        const data = {
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
            members: {
                connect: { id: userId }
            }
        };

        const societe = await prisma.societe.create({
            data: data
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
    try {
        const { id, ...data } = societe;
        // Clean undefined/null values if necessary or let Prisma handle it
        await prisma.societe.update({
            where: { id },
            data: data
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
