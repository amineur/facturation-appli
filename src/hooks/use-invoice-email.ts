import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { updateInvoice, updateQuote, registerDocumentEmailSent } from '@/app/actions';
import { useData } from '@/components/data-provider';
import { Facture, Devis, EmailLog } from '@/types';

export function useInvoiceEmail() {
    const { societe, clients, refreshData, logAction } = useData();
    const [isUndoVisible, setIsUndoVisible] = useState(false);
    const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
    const [lastDraft, setLastDraft] = useState<any>(null);

    const sendEmail = async (
        invoice: Facture | Devis,
        emailData: { to: string; subject: string; message: string; additionalAttachments: File[]; scheduledAt?: string },
        options?: { onSuccess?: () => void, isResend?: boolean, relatedEmailId?: string }
    ) => {
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client || !societe) {
            toast.error("Données manquantes (Client ou Société)");
            return;
        }

        try {
            // 1. Generate PDF
            const isDevis = invoice.type === 'Devis';
            const pdfBase64 = generateInvoicePDF(invoice, societe, client, { returnBase64: true });
            const attachments = [
                { filename: `${isDevis ? 'Devis' : 'Facture'}_${invoice.numero}.pdf`, content: pdfBase64, contentType: 'application/pdf' }
            ];

            // Additional files
            for (const file of emailData.additionalAttachments) {
                const buffer = await file.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                attachments.push({ filename: file.name, content: base64, contentType: file.type });
            }

            const hasHistory = (invoice.emails || []).some(e => e.status === 'sent' && (e.actionType === 'envoi' || e.actionType === 'relance'));
            const isRelance = options?.isResend || hasHistory;

            // SCHEDULED
            if (emailData.scheduledAt) {
                const scheduledLog: EmailLog = {
                    id: uuidv4(), documentId: invoice.id, date: new Date().toISOString(),
                    scheduledAt: emailData.scheduledAt,
                    actionType: isRelance ? 'relance' : 'envoi',
                    to: emailData.to, subject: emailData.subject, message: emailData.message,
                    status: 'scheduled',
                    attachments: attachments.map(att => ({ name: att.filename, type: att.contentType, content: att.content as string })),
                    relatedEmailId: options?.relatedEmailId
                };

                const allEmails = [...(invoice.emails || []), scheduledLog];
                await registerDocumentEmailSent(isDevis ? 'devis' : 'facture', invoice.id, allEmails);

                toast.success(`Programmé pour le ${format(new Date(emailData.scheduledAt), "d MMM HH:mm", { locale: fr })}`);
                refreshData();
                options?.onSuccess?.();
                return;
            }

            // IMMEDIATE SEND (DELAYED)
            const executeSend = async () => {
                try {

                    const response = await fetch('/api/send-email', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: emailData.to,
                            subject: emailData.subject,
                            message: emailData.message,
                            attachments,
                            societeId: societe.id
                        })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);

                    console.log("[DEBUG_EMAIL] Step 1: Succès API Mail", result.messageId);

                    const newEmailLog: EmailLog = {
                        id: uuidv4(), documentId: invoice.id, date: new Date().toISOString(),
                        actionType: isRelance ? 'relance' : 'envoi',
                        to: emailData.to, subject: emailData.subject, message: emailData.message,
                        status: 'sent',
                        attachments: attachments.map(att => ({ name: att.filename, type: att.contentType })),
                        relatedEmailId: options?.relatedEmailId
                    };

                    const allEmails = [...(invoice.emails || []), newEmailLog];

                    console.log("[DEBUG_EMAIL] Step 2: Appel Server Action Unified", { type: isDevis ? 'devis' : 'facture', id: invoice.id });

                    const serverRes = await registerDocumentEmailSent(isDevis ? 'devis' : 'facture', invoice.id, allEmails);

                    if (!serverRes.success) throw new Error(serverRes.error);

                    console.log("[DEBUG_EMAIL] Step 3: Réponse Server Action OK");

                    if (result.previewUrl) window.open(result.previewUrl, '_blank');

                    toast.success(isRelance ? "Relance envoyée avec succès" : "Email envoyé avec succès");
                    logAction('update', isDevis ? 'devis' : 'facture', `${isRelance ? 'Relance' : 'Email'} envoyé pour ${isDevis ? 'le devis' : 'la facture'} ${invoice.numero} à ${emailData.to}`, invoice.id);

                    console.log("[DEBUG_EMAIL] Step 4: RefreshData call");
                    await refreshData();

                    console.log("[DEBUG_EMAIL] Step 5: UI Flow Complete (Modal closure should have happened, history is refreshed)");
                } catch (e: any) {
                    console.error("[DEBUG_EMAIL] Error in executeSend:", e);
                    toast.error("Erreur envoi: " + e.message);
                }
            };

            const timer = setTimeout(() => {
                executeSend();
                setIsUndoVisible(false);
            }, 4000);
            setUndoTimer(timer);

            setLastDraft({ ...emailData, invoiceId: invoice.id }); // Store invoiceId to know context
            setIsUndoVisible(true);
            options?.onSuccess?.();

            return Promise.resolve();

        } catch (error: any) {
            console.error(error);
            toast.error("Erreur prépa envoi: " + error.message);
        }
    };

    const cancelSend = () => {
        if (undoTimer) clearTimeout(undoTimer);
        setIsUndoVisible(false);
        toast("Envoi annulé");
        return lastDraft; // Returns draft data to restore
    };

    return { sendEmail, isUndoVisible, cancelSend };
}
