"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from "next/cache";

export async function getDocumentEmailHistory(type: 'facture' | 'devis', id: string) {
    try {
        if (type === 'facture') {
            const doc = await prisma.facture.findUnique({
                where: { id },
                select: { emailsJSON: true }
            });
            if (!doc) return { success: false, error: "Document introuvable" };
            const emails = doc.emailsJSON ? JSON.parse(doc.emailsJSON) : [];
            return { success: true, data: emails };
        } else {
            const doc = await prisma.devis.findUnique({
                where: { id },
                select: { emailsJSON: true }
            });
            if (!doc) return { success: false, error: "Document introuvable" };
            const emails = doc.emailsJSON ? JSON.parse(doc.emailsJSON) : [];
            return { success: true, data: emails };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function registerDocumentEmailSent(type: 'facture' | 'devis', id: string, emails: any[]) {
    try {
        const json = JSON.stringify(emails);
        if (type === 'facture') {
            const invoice = await prisma.facture.findUnique({ where: { id }, select: { statut: true } });

            // Auto-transition to "Envoyée" if currently "Brouillon" or "Téléchargée"
            let newStatus = undefined;
            if (invoice && (invoice.statut === "Brouillon" || invoice.statut === "Téléchargée")) {
                newStatus = "Envoyée";
            }

            await prisma.facture.update({
                where: { id },
                data: {
                    emailsJSON: json,
                    ...(newStatus ? { statut: newStatus } : {})
                }
            });
        } else {
            // For Quotes, same logic: Auto-transition to "Envoyé" if currently "Brouillon"
            const quote = await prisma.devis.findUnique({ where: { id }, select: { statut: true } });
            let newStatus = undefined;
            if (quote && (quote.statut === "Brouillon" || quote.statut === "Téléchargé")) {
                newStatus = "Envoyé";
            }

            await prisma.devis.update({
                where: { id },
                data: {
                    emailsJSON: json,
                    ...(newStatus ? { statut: newStatus } : {})
                }
            });
        }
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
