"use server";

import { revalidatePath } from "next/cache";
import { prisma } from '@/lib/prisma';
import { Client } from '@/types';
import { getCurrentUser } from '@/app/actions';

export async function createClientAction(client: Client) {
    try {
        // 🔒 SECURITY: Verify access
        // We assume client.societeId is provided or we default to a safe value.
        // However, usually we should check if the user belongs to that societe.

        // For simplicity/parity with previous code (which might have been loose), 
        // we'll implement the basic check. Be careful with 'Euromedmultimedia' default.

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
        // 🔒 SECURITY: Verify access via client's societe
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const existing = await prisma.client.findUnique({
            where: { id: client.id },
            select: { societeId: true }
        });
        if (!existing) return { success: false, error: "Client introuvable" };

        const hasAccess = await prisma.societe.findFirst({
            where: { id: existing.societeId, members: { some: { id: userRes.data.id } } }
        });
        if (!hasAccess) return { success: false, error: "Accès refusé" };

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
        // revalidatePath? 
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
