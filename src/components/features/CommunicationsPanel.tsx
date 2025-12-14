"use client";

import { useData } from "@/components/data-provider";
import { EmailHistoryView } from "@/components/features/EmailHistoryView";
import { EmailComposer } from "@/components/features/EmailComposer";
import { Send, Mail, Pencil, X, Minimize2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { updateInvoice, updateQuote, getDocumentEmailHistory } from "@/app/actions";
import { v4 as uuidv4 } from "uuid";
import { useState, useRef, useEffect } from "react";
import { EmailLog, Facture, Devis } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CommunicationsPanelProps {
    invoice: Facture | Devis;
    defaultComposeOpen?: boolean;
    hideComposeButton?: boolean;
}

export function CommunicationsPanel({ invoice, defaultComposeOpen = false, hideComposeButton = false }: CommunicationsPanelProps) {
    const { clients, societe, refreshData, logAction } = useData();
    const client = clients.find(c => c.id === invoice.clientId);
    const [historyEmails, setHistoryEmails] = useState<EmailLog[]>(invoice.emails || []);

    // Fetch fresh history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            const result = await getDocumentEmailHistory(invoice.type === 'Devis' ? 'devis' : 'facture', invoice.id);
            if (result.success && result.data) {
                setHistoryEmails(result.data);
            }
        };
        fetchHistory();
    }, [invoice.id, invoice.type]);



    // State pour gérer les relances
    const [resendingEmail, setResendingEmail] = useState<EmailLog | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(defaultComposeOpen);
    const [isUndoVisible, setIsUndoVisible] = useState(false);
    const [lastDraft, setLastDraft] = useState<any>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const undoTimerRef = useRef<NodeJS.Timeout>(null);

    // Open composer when resending
    useEffect(() => {
        if (resendingEmail) {
            setIsComposerOpen(true);
        }
    }, [resendingEmail]);

    // Initialize composer state based on prop (only on mount)
    useEffect(() => {
        if (defaultComposeOpen) {
            setIsComposerOpen(true);
        }
    }, [defaultComposeOpen]);


    const handleSendEmail = async (emailData: { to: string; subject: string; message: string; additionalAttachments: File[]; scheduledAt?: string }) => {
        // ... (Same logic as page.tsx) ...
        // Using copied logic
        try {
            // 1. Generate PDF Base64
            const isDevis = invoice.type === 'Devis';
            const pdfBase64 = generateInvoicePDF(invoice, societe!, client!, { returnBase64: true });

            const attachments = [
                {
                    filename: `${isDevis ? 'Devis' : 'Facture'}_${invoice.numero}.pdf`,
                    content: pdfBase64,
                    contentType: 'application/pdf'
                }
            ];

            for (const file of emailData.additionalAttachments) {
                const buffer = await file.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                attachments.push({
                    filename: file.name,
                    content: base64,
                    contentType: file.type
                });
            }

            const hasHistory = (invoice.emails || []).some(e => e.status === 'sent' && (e.actionType === 'envoi' || e.actionType === 'relance'));
            const isRelance = resendingEmail || hasHistory;

            if (emailData.scheduledAt) {
                const scheduledLog: EmailLog = {
                    id: uuidv4(),
                    documentId: invoice.id,
                    date: new Date().toISOString(),
                    scheduledAt: emailData.scheduledAt,
                    actionType: isRelance ? 'relance' : 'envoi',
                    to: emailData.to,
                    subject: emailData.subject,
                    message: emailData.message,
                    status: 'scheduled',
                    attachments: attachments.map(att => ({
                        name: att.filename,
                        type: att.contentType,
                        content: att.content as string
                    })),
                    relatedEmailId: resendingEmail?.id
                };

                const updatedEmails = [...(invoice.emails || []), scheduledLog];
                if (isDevis) {
                    const updatedQuote = { ...(invoice as Devis), emails: updatedEmails };
                    if (updatedQuote.statut === 'Brouillon') updatedQuote.statut = 'Envoyé';
                    await updateQuote(updatedQuote);
                } else {
                    const updatedFacture = { ...(invoice as Facture), emails: updatedEmails };
                    if (updatedFacture.statut === 'Brouillon') updatedFacture.statut = 'Envoyée';
                    await updateInvoice(updatedFacture);
                }

                toast.success(`Email programmé pour le ${format(new Date(emailData.scheduledAt), "d MMM à HH:mm", { locale: fr })}`);
                setHistoryEmails(prev => [...prev, scheduledLog]);
                refreshData();
                setResendingEmail(null);
                return;
            }

            const executeSend = async () => {
                try {
                    const response = await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: emailData.to,
                            subject: emailData.subject,
                            message: emailData.message,
                            attachments
                        })
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || "Erreur lors de l'envoi");
                    }

                    const newEmailLog: EmailLog = {
                        id: uuidv4(),
                        documentId: invoice.id,
                        date: new Date().toISOString(),
                        actionType: isRelance ? 'relance' : 'envoi',
                        to: emailData.to,
                        subject: emailData.subject,
                        message: emailData.message,
                        status: 'sent',
                        attachments: attachments.map(att => ({
                            name: att.filename,
                            type: att.contentType
                        })),
                        relatedEmailId: resendingEmail?.id
                    };

                    const updatedEmails = [...(invoice.emails || []), newEmailLog];
                    let saveResult;
                    if (isDevis) {
                        const updatedDevis = { ...(invoice as Devis), emails: updatedEmails };
                        if (updatedDevis.statut === 'Brouillon') {
                            updatedDevis.statut = 'Envoyé';
                        }
                        saveResult = await updateQuote(updatedDevis);
                    } else {
                        const updatedFacture = { ...(invoice as Facture), emails: updatedEmails };
                        if (updatedFacture.statut === 'Brouillon') {
                            updatedFacture.statut = 'Envoyée';
                        }
                        saveResult = await updateInvoice(updatedFacture);
                    }

                    if (!saveResult.success) {
                        console.error("Failed to save email history:", saveResult.error);
                    }

                    const actionLabel = isRelance ? 'Relance envoyée' : 'Email envoyé';
                    logAction('update', isDevis ? 'devis' : 'facture', `${actionLabel} pour ${isDevis ? 'le devis' : 'la facture'} ${invoice.numero} à ${emailData.to}`, invoice.id);
                    toast.success(isRelance ? "Relance envoyée avec succès" : "Email envoyé avec succès");
                    setHistoryEmails(prev => [...prev, newEmailLog]);
                    refreshData();

                } catch (error: any) {
                    toast.error("Erreur lors de l'envoi: " + error.message);
                }
            };

            undoTimerRef.current = setTimeout(() => {
                executeSend();
                setIsUndoVisible(false);
            }, 4000);

            setLastDraft({
                id: 'restore-' + Date.now(),
                to: emailData.to,
                subject: emailData.subject,
                message: emailData.message
            });
            setIsUndoVisible(true);

            setResendingEmail(null);
            setIsComposerOpen(false);
            return Promise.resolve();

        } catch (error: any) {
            toast.error("Erreur d'envoi: " + error.message);
        }
    };

    return (
        <div className="h-full relative flex flex-col">
            {/* History List */}
            <div className="flex-1 space-y-4 p-4 pb-24"> {/* pb-24 for space for Floating Button */}
                <div className="glass-card rounded-xl p-6 border border-border dark:border-white/10">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        Historique
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({historyEmails.length})
                        </span>
                    </h2>
                    <EmailHistoryView emails={historyEmails} />
                </div>
            </div>

            {/* Floating Compose Button */}
            {!isComposerOpen && !isUndoVisible && !hideComposeButton && (
                <div className="absolute bottom-6 right-6 z-10">
                    <button
                        onClick={() => setIsComposerOpen(true)}
                        className="flex items-center gap-3 px-6 py-4 bg-[#c2e7ff] text-[#001d35] rounded-2xl shadow-lg hover:shadow-xl hover:bg-[#b0dcf8] transition-all transform hover:scale-105 font-medium"
                    >
                        <Pencil className="h-5 w-5" />
                        Nouveau message
                    </button>
                </div>
            )}

            {/* Compose Window */}
            {isComposerOpen && (
                <div className="absolute bottom-0 left-4 right-4 h-[500px] bg-background dark:bg-[#1e1e1e] border border-border dark:border-white/10 rounded-t-xl shadow-2xl z-20 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 dark:bg-[#1e1e1e] border-b border-border dark:border-white/10 cursor-pointer" onClick={() => setIsComposerOpen(false)}>
                        <span className="text-sm font-medium">Nouveau message</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <button className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}>
                                <Minimize2 className="h-4 w-4" />
                            </button>
                            <button className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded hover:text-red-400" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden bg-background dark:bg-[#1e1e1e]">
                        <EmailComposer
                            key={resendingEmail ? `resend-${resendingEmail.id}` : 'new-email'}
                            defaultTo={resendingEmail ? resendingEmail.to : (client?.email || "")}
                            defaultSubject={resendingEmail
                                ? (resendingEmail.subject.startsWith("Rappel") || resendingEmail.subject.startsWith("Relance") ? resendingEmail.subject : `Rappel : ${resendingEmail.subject}`)
                                : `${invoice.type === 'Devis' ? 'Devis' : 'Facture'} ${invoice.numero} - ${societe?.nom}`}
                            defaultMessage={resendingEmail ? resendingEmail.message : `Madame, Monsieur,\n\nVeuillez trouver ci-joint votre ${invoice.type === 'Devis' ? 'devis' : 'facture'} n°${invoice.numero}.\n\nCordialement,\n${societe?.nom || ""}`}
                            mainAttachmentName={`${invoice.type === 'Devis' ? 'Devis' : 'Facture'}_${invoice.numero}.pdf`}
                            onSend={handleSendEmail}
                        />
                    </div>
                </div>
            )}

            {/* Undo Notification - Theme Aware */}
            {isUndoVisible && (
                <div className="absolute bottom-6 right-6 left-6 bg-muted border border-border text-foreground dark:bg-zinc-900 dark:border-zinc-800 dark:text-white px-4 py-3 rounded-lg shadow-2xl z-30 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-300">
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">Envoyé</span>
                    </div>
                    <button
                        onClick={() => {
                            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                            setIsUndoVisible(false);
                            toast("Envoi annulé");
                            if (lastDraft) {
                                setResendingEmail(lastDraft);
                                setIsComposerOpen(true);
                            }
                        }}
                        className="ml-auto px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded"
                    >
                        Annuler
                    </button>
                </div>
            )}

        </div>
    );
}
