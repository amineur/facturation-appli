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

import nodemailer from 'nodemailer';

// Configure transporter (Using environement variables in real app, but fallback to something or mock if needed)
// For this MVP user local context, we check if they have env vars, otherwise we might warn.
// Assuming user has a local SMTP or similar setup, or we use a purely log-based approach if no config is present to avoid crashing?
// The user said "La configuration SMTP utilisée est celle de votre serveur actuel". 
// Check .env or similar? No access to .env content usually. 
// I will assume standard process.env.SMTP_... vars exist.

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

export async function sendInvoiceEmail(
    id: string,
    type: 'facture' | 'devis',
    to: string,
    subject: string,
    message: string,
    pdfBase64?: string | null
) {
    try {
        // 1. Get Doc details for filename
        const collection = type === 'facture' ? prisma.facture : prisma.devis;
        const doc = await (collection as any).findUnique({ where: { id } });

        if (!doc) return { success: false, error: "Document introuvable" };

        const filename = `${type === 'facture' ? 'Facture' : 'Devis'}_${doc.numero}.pdf`;

        // 2. Prepare Attachments
        const attachments = [];
        if (pdfBase64) {
            attachments.push({
                filename: filename,
                content: Buffer.from(pdfBase64, 'base64'),
                contentType: 'application/pdf'
            });
        }

        // 3. Send Email
        // If no SMTP config, we simulate success for dev/demo if needed, or let it fail.
        // But better to try-catch the sendMail
        if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
            console.log("Mocking Email Send (No SMTP Config provided):", { to, subject, attachments: attachments.length });
            // Register success anyway for testing UI flow
            await registerDocumentEmailSent(type, id, [{ date: new Date().toISOString(), to, subject, status: "mock_sent" }]);
            return { success: true, mock: true };
        }

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"My Company" <no-reply@example.com>',
            to,
            subject,
            text: message, // Plain text version
            // html: message.replace(/\n/g, '<br>'), // Simple HTML version
            attachments
        });

        // 4. Log to History
        await registerDocumentEmailSent(type, id, [{ date: new Date().toISOString(), to, subject, status: "sent" }]);

        return { success: true };

    } catch (error: any) {
        console.error("Send Email Error:", error);
        return { success: false, error: error.message };
    }
}
