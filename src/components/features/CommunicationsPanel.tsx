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
import { useInvoiceEmail } from "@/hooks/use-invoice-email";


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

    // Sync history when props change (specifically for refreshData after sending)
    useEffect(() => {
        if (invoice.emails) {
            setHistoryEmails(invoice.emails);
        }
    }, [invoice.emails]);



    // State pour gérer les relances
    const [resendingEmail, setResendingEmail] = useState<EmailLog | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(defaultComposeOpen);
    const { sendEmail, isUndoVisible, cancelSend } = useInvoiceEmail();
    const [draftData, setDraftData] = useState<any>(null);


    // Open composer when resending
    useEffect(() => {
        if (resendingEmail) {
            setIsComposerOpen(true);
            setDraftData(null); // Reset draft when manual resend
        }
    }, [resendingEmail]);


    // Initialize composer state based on prop (only on mount)
    useEffect(() => {
        if (defaultComposeOpen) {
            setIsComposerOpen(true);
        }
    }, [defaultComposeOpen]);


    const onSendInternal = async (emailData: any) => {
        setIsComposerOpen(false);
        setResendingEmail(null);
        await sendEmail(invoice, emailData, {
            onSuccess: () => {
                // No need to close here anymore as it's done immediately
            },
            isResend: !!resendingEmail,
            relatedEmailId: resendingEmail?.id
        });
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
            {!isComposerOpen && !isUndoVisible && !hideComposeButton && invoice.statut !== 'Annulée' && (
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
                            key={draftData ? 'draft-restore' : (resendingEmail ? `resend-${resendingEmail.id}` : 'new-email')}
                            defaultTo={draftData ? draftData.to : (resendingEmail ? resendingEmail.to : (client?.email || ""))}
                            defaultSubject={draftData ? draftData.subject : (resendingEmail
                                ? (resendingEmail.subject.startsWith("Rappel") || resendingEmail.subject.startsWith("Relance") ? resendingEmail.subject : `Rappel : ${resendingEmail.subject}`)
                                : `${invoice.type === 'Devis' ? 'Devis' : 'Facture'} ${invoice.numero} - ${societe?.nom}`)}
                            defaultMessage={draftData ? draftData.message : (resendingEmail ? resendingEmail.message : `Madame, Monsieur,\n\nVeuillez trouver ci-joint votre ${invoice.type === 'Devis' ? 'devis' : 'facture'} n°${invoice.numero}.\n\nCordialement,\n${societe?.nom || ""}`)}
                            mainAttachmentName={`${invoice.type === 'Devis' ? 'Devis' : 'Facture'}_${invoice.numero}.pdf`}
                            onSend={onSendInternal}
                        />
                    </div>

                </div>
            )}

            {/* Undo Notification - Theme Aware */}
            {isUndoVisible && (
                <div className="absolute bottom-6 right-6 left-6 bg-background border border-border text-foreground dark:bg-[#1e1e1e] dark:border-zinc-800 dark:text-white px-4 py-3 rounded-lg shadow-2xl z-30 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-300">
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">Message envoyé</span>
                        <span className="text-xs text-muted-foreground">Envoi en cours...</span>
                    </div>
                    <button
                        onClick={() => {
                            const restored = cancelSend();
                            if (restored) {
                                setDraftData(restored);
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
