"use server";

import { prisma } from '@/lib/prisma';
import { Client } from '@/types';

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

export async function updateClientAction(client: Client) {
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
