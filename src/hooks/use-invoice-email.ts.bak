import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { updateInvoice, updateQuote } from '@/app/actions';
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
                if (isDevis) {
                    const updatedQuote = { ...(invoice as Devis), emails: [...(invoice.emails || []), scheduledLog] };
                    if (updatedQuote.statut === 'Brouillon') updatedQuote.statut = 'Envoyé';
                    await updateQuote(updatedQuote);
                } else {
                    const updatedFacture = { ...(invoice as Facture), emails: [...(invoice.emails || []), scheduledLog] };
                    if (updatedFacture.statut === 'Brouillon') updatedFacture.statut = 'Envoyée';
                    await updateInvoice(updatedFacture);
                }
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
                        body: JSON.stringify({ to: emailData.to, subject: emailData.subject, message: emailData.message, attachments })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);

                    const newEmailLog: EmailLog = {
                        id: uuidv4(), documentId: invoice.id, date: new Date().toISOString(),
                        actionType: isRelance ? 'relance' : 'envoi',
                        to: emailData.to, subject: emailData.subject, message: emailData.message,
                        status: 'sent',
                        attachments: attachments.map(att => ({ name: att.filename, type: att.contentType })),
                        relatedEmailId: options?.relatedEmailId
                    };
                    if (isDevis) {
                        const updatedDevis = {
                            ...(invoice as Devis),
                            emails: [...(invoice.emails || []), newEmailLog]
                        };
                        if (updatedDevis.statut === 'Brouillon') {
                            updatedDevis.statut = 'Envoyé';
                        }
                        await updateQuote(updatedDevis);
                    } else {
                        const updatedFacture = {
                            ...(invoice as Facture),
                            emails: [...(invoice.emails || []), newEmailLog]
                        };
                        if (updatedFacture.statut === 'Brouillon') {
                            updatedFacture.statut = 'Envoyée';
                        }
                        await updateInvoice(updatedFacture);
                    }

                    if (result.previewUrl) window.open(result.previewUrl, '_blank');

                    logAction('update', isDevis ? 'devis' : 'facture', `${isRelance ? 'Relance' : 'Email'} envoyé à ${emailData.to}`, invoice.id);
                    refreshData();
                } catch (e: any) {
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
