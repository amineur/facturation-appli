"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/components/data-provider";
import { EmailHistoryView } from "@/components/features/EmailHistoryView";
import { EmailComposer } from "@/components/features/EmailComposer";
import { ArrowLeft, Send, Mail, Pencil, X, Minimize2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { updateInvoice } from "@/app/actions";
import { v4 as uuidv4 } from "uuid";
import { useState, useRef, useEffect } from "react";
import { EmailLog } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CommunicationsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { invoices, clients, societe, refreshData, logAction } = useData();

    const invoiceId = params.id as string;
    const invoice = invoices.find(inv => inv.id === invoiceId);
    const client = clients.find(c => c.id === invoice?.clientId);

    // State pour gérer les relances
    const [resendingEmail, setResendingEmail] = useState<EmailLog | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [isUndoVisible, setIsUndoVisible] = useState(false);
    const [lastDraft, setLastDraft] = useState<any>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const undoTimerRef = useRef<NodeJS.Timeout>(null);

    // Open composer when resending OR when query param ?compose=true exists
    useEffect(() => {
        if (resendingEmail) {
            setIsComposerOpen(true);
        } else if (searchParams.get('compose') === 'true') {
            setIsComposerOpen(true);
        }
    }, [resendingEmail, searchParams]);

    if (!invoice) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-muted-foreground">Facture non trouvée</p>
            </div>
        );
    }

    const handleSendEmail = async (emailData: { to: string; subject: string; message: string; additionalAttachments: File[]; scheduledAt?: string }) => {
        try {
            // 1. Generate PDF Base64
            const pdfBase64 = generateInvoicePDF(invoice, societe!, client!, { returnBase64: true });

            // 2. Prepare Attachments
            const attachments = [
                {
                    filename: `Facture_${invoice.numero}.pdf`,
                    content: pdfBase64,
                    contentType: 'application/pdf'
                }
            ];

            // Add additional files
            for (const file of emailData.additionalAttachments) {
                const buffer = await file.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                attachments.push({
                    filename: file.name,
                    content: base64,
                    contentType: file.type
                });
            }

            // Determine relative logic early for consistent logs regardless of schedule
            const hasHistory = (invoice.emails || []).some(e => e.status === 'sent' && (e.actionType === 'envoi' || e.actionType === 'relance'));
            const isRelance = resendingEmail || hasHistory;

            if (emailData.scheduledAt) {
                // SCHEDULING MODE
                const scheduledLog: EmailLog = {
                    id: uuidv4(),
                    documentId: invoice.id,
                    date: new Date().toISOString(), // Creation date
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
                const updatedInvoice = { ...invoice, emails: updatedEmails };
                await updateInvoice(updatedInvoice);

                toast.success(`Email programmé pour le ${format(new Date(emailData.scheduledAt), "d MMM à HH:mm", { locale: fr })}`);
                refreshData();
                setResendingEmail(null);
                return; // STOP HERE
            }

            // --- UNDO SEND LOGIC ---

            const executeSend = async () => {
                try {
                    // 3. Send to API
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

                    // 4. Create email log entry
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

                    // 5. Update invoice with new email log
                    const updatedEmails = [...(invoice.emails || []), newEmailLog];
                    const updatedInvoice = { ...invoice, emails: updatedEmails };
                    const saveResult = await updateInvoice(updatedInvoice);

                    if (!saveResult.success) {
                        console.error("Failed to save email history:", saveResult.error);
                        toast.error("Email envoyé mais échec de la sauvegarde de l'historique.");
                    }

                    if (result.previewUrl) {
                        toast.success(`Email envoyé via Ethereal !`, {
                            duration: 5000,
                            action: { label: 'Voir', onClick: () => window.open(result.previewUrl, '_blank') }
                        });
                    }

                    const actionLabel = isRelance ? 'Relance envoyée' : 'Email envoyé';
                    logAction('update', 'facture', `${actionLabel} à ${emailData.to}`, invoice.id);
                    refreshData();

                } catch (error: any) {
                    console.error("Delayed send error:", error);
                    toast.error("Erreur lors de l'envoi différé: " + error.message);

                    // Log failure persistence logic could go here
                }
            };

            // Start Optimistic UI + Timer
            undoTimerRef.current = setTimeout(() => {
                executeSend();
                setIsUndoVisible(false);
            }, 4000);

            // Show Custom Undo Notification
            setLastDraft({
                id: 'restore-' + Date.now(),
                to: emailData.to,
                subject: emailData.subject,
                message: emailData.message
            });
            setIsUndoVisible(true);

            // Reset current UI immediately
            setResendingEmail(null);
            setIsComposerOpen(false);

            // Return promise that resolves immediately so UI unblocks
            return Promise.resolve();

        } catch (error: any) {
            console.error("Email send error:", error);
            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
            toast.error("Erreur d'envoi: " + errorMessage);

            // Log failed attempt
            try {
                // Determine if it WAS a relance attempt
                const hasHistoryAttempt = (invoice.emails || []).some(e => e.status === 'sent' && (e.actionType === 'envoi' || e.actionType === 'relance'));
                const isRelanceAttempt = resendingEmail || hasHistoryAttempt;

                const failedLog: EmailLog = {
                    id: uuidv4(),
                    documentId: invoice.id,
                    date: new Date().toISOString(),
                    actionType: isRelanceAttempt ? 'relance' : 'envoi',
                    to: emailData.to,
                    subject: `[ÉCHEC] ${emailData.subject}`,
                    message: `${emailData.message}\n\n--- ERREUR TECHNIQUE ---\n${errorMessage}`,
                    status: 'failed',
                    attachments: [], // We might not have them ready if failure happened early, simplified for safety
                    relatedEmailId: resendingEmail?.id
                };

                const updatedEmails = [...(invoice.emails || []), failedLog];
                const updatedInvoice = { ...invoice, emails: updatedEmails };
                await updateInvoice(updatedInvoice);
                refreshData();
            } catch (logError) {
                console.error("Failed to log error to history:", logError);
            }
        }
    };

    // Handler pour relancer un email
    const handleResend = (email: EmailLog) => {
        setResendingEmail(email);
        toast.info("Formulaire pré-rempli pour relance");
        // Scroll to composer
        composerRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent flex items-center gap-2">
                        <Send className="h-8 w-8" />
                        Communications
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Facture {invoice.numero} - {client?.nom}
                    </p>
                </div>
            </div>

            {/* Main Content: History is now primary */}
            <div className="space-y-6">
                {/* Email History */}
                <div className="glass-card rounded-xl p-6 border border-white/10 min-h-[500px]">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        Historique d'envoi
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({invoice.emails?.length || 0} email{(invoice.emails?.length || 0) > 1 ? 's' : ''})
                        </span>
                    </h2>
                    <div className="overflow-y-auto custom-scrollbar">
                        <EmailHistoryView emails={invoice.emails || []} />
                    </div>
                </div>
            </div>

            {/* Gmail-style Floating Compose Action */}
            {!isComposerOpen && !isUndoVisible && (
                <button
                    onClick={() => setIsComposerOpen(true)}
                    className="fixed bottom-6 right-6 flex items-center gap-3 px-6 py-4 bg-[#c2e7ff] text-[#001d35] rounded-2xl shadow-lg hover:shadow-xl hover:bg-[#b0dcf8] transition-all transform hover:scale-105 z-50 font-medium"
                >
                    <Pencil className="h-5 w-5" />
                    Nouveau message
                </button>
            )}

            {/* Gmail-style Compose Window */}
            {isComposerOpen && (
                <div className="fixed bottom-0 right-10 w-[600px] h-[600px] bg-background dark:bg-[#1e1e1e] border border-border dark:border-white/10 rounded-t-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                    {/* Window Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 dark:bg-[#1e1e1e] border-b border-border dark:border-white/10 cursor-pointer" onClick={() => setIsComposerOpen(false)}>
                        <span className="text-sm font-medium">Nouveau message</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <button className="p-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}>
                                <Minimize2 className="h-4 w-4" />
                            </button>
                            <button className="p-1 hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); /* TODO: Maximize */ }}>
                                <Maximize2 className="h-4 w-4" />
                            </button>
                            <button className="p-1 hover:bg-white/10 rounded hover:text-red-400" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Composer Content */}
                    <div className="flex-1 overflow-hidden bg-background dark:bg-[#1e1e1e]">
                        <EmailComposer
                            key={resendingEmail ? `resend-${resendingEmail.id}` : 'new-email'}
                            defaultTo={resendingEmail ? resendingEmail.to : (client?.email || "")}
                            defaultSubject={resendingEmail
                                ? (resendingEmail.subject.startsWith("Rappel") || resendingEmail.subject.startsWith("Relance") ? resendingEmail.subject : `Rappel : ${resendingEmail.subject}`)
                                : `Facture ${invoice.numero} - ${societe?.nom}`}
                            defaultMessage={resendingEmail ? resendingEmail.message : `Madame, Monsieur,\n\nVeuillez trouver ci-joint votre facture n°${invoice.numero}.\n\nCordialement,\n${societe?.nom || ""}`}
                            mainAttachmentName={`Facture_${invoice.numero}.pdf`}
                            onSend={handleSendEmail}
                        />
                    </div>
                </div>
            )}
            {/* Google-Style Undo Notification */}
            {isUndoVisible && (
                <div className="fixed bottom-6 right-6 bg-muted border border-border text-foreground dark:bg-zinc-900 dark:border-zinc-800 dark:text-white px-6 py-4 rounded-lg shadow-2xl z-[60] flex items-center gap-6 animate-in slide-in-from-bottom-5 duration-300 min-w-[320px]">
                    <div className="flex flex-col">
                        <span className="font-medium">Message envoyé</span>
                        <span className="text-xs text-muted-foreground">Envoi en cours...</span>
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
                        className="ml-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded transition-colors"
                    >
                        Annuler
                    </button>
                </div>
            )}
        </div>
    );
}
