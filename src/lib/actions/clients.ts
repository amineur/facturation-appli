"use server";

import { prisma } from '@/lib/prisma';
import { Client } from '@/types';
import { getCurrentUser } from './auth';
import { canAccessSociete } from './members';
import { MembershipRole } from '@prisma/client';

export async function fetchClients(societeId: string): Promise<{ success: boolean, data?: Client[], error?: string }> {
    try {
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, societeId, MembershipRole.VIEWER);
        if (!authorized) return { success: false, error: "Accès refusé" };

        const clients = await prisma.client.findMany({
            where: { societeId },
            orderBy: { nom: 'asc' }
        });

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
        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const targetSocieteId = client.societeId || userRes.data.currentSocieteId;
        if (!targetSocieteId) return { success: false, error: "Société non spécifiée" };

        const authorized = await canAccessSociete(userRes.data.id, targetSocieteId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        const res = await prisma.client.create({
            data: {
                societeId: targetSocieteId,
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
        const existing = await prisma.client.findUnique({ where: { id: client.id }, select: { societeId: true } });
        if (!existing) return { success: false, error: "Client introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, existing.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

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

export async function deleteClient(id: string) {
    if (!id) return { success: false, error: "ID manquant" };
    try {
        const existing = await prisma.client.findUnique({ where: { id }, select: { societeId: true } });
        if (!existing) return { success: false, error: "Client introuvable" };

        const userRes = await getCurrentUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const authorized = await canAccessSociete(userRes.data.id, existing.societeId, MembershipRole.EDITOR);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        await prisma.client.delete({ where: { id } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
