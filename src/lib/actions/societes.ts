"use server";

import { prisma } from '@/lib/prisma';

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
        const societes = await prisma.societe.findMany();
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

export async function createSociete(nom: string) {
    try {
        const societe = await prisma.societe.create({
            data: { nom }
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
