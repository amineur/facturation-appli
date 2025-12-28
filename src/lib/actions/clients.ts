"use server";

import { prisma } from '@/lib/prisma';
import { Client } from '@/types';

export async function fetchClients(societeId: string): Promise<{ success: boolean, data?: Client[], error?: string }> {
    try {
        const clients = await prisma.client.findMany({
            where: { societeId },
            orderBy: { nom: 'asc' }
        });

        // Map to ensure type safety
        const mapped: Client[] = clients.map((c: any) => ({
            id: c.id,
            societeId: c.societeId,
            nom: c.nom,
            email: c.email || undefined,
            telephone: c.telephone || undefined,
            adresse: c.adresse || undefined,
            ville: c.ville || undefined,
            codePostal: c.codePostal || undefined,
            pays: c.pays || undefined,
            siret: c.siret || undefined,
            tvaIntra: c.tvaIntra || undefined
        }));

        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createClientAction(client: Client) {
    try {
        const res = await prisma.client.create({
            data: {
                societeId: client.societeId || "Euromedmultimedia",
                nom: client.nom,
                email: client.email,
                telephone: client.telephone,
                adresse: client.adresse,
                ville: client.ville,
                codePostal: client.codePostal,
                pays: client.pays,
                siret: client.siret,
                tvaIntra: client.tvaIntra
            }
        });
        return { success: true, id: res.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateClient(client: Client) {
    if (!client.id) return { success: false, error: "ID manquant" };
    try {
        await prisma.client.update({
            where: { id: client.id },
            data: {
                nom: client.nom,
                email: client.email,
                telephone: client.telephone,
                adresse: client.adresse,
                ville: client.ville,
                codePostal: client.codePostal,
                pays: client.pays,
                siret: client.siret,
                tvaIntra: client.tvaIntra
            }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
