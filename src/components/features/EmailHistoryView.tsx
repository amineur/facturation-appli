import { EmailLog } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, Clock, Mail, AlertCircle, Paperclip, ChevronDown, ChevronUp, Send, Download, RefreshCw } from "lucide-react";
import { useState } from "react";

interface EmailHistoryViewProps {
    emails: EmailLog[];
    onResend?: (email: EmailLog) => void; // Callback pour relancer un email
}

export function EmailHistoryView({ emails, onResend }: EmailHistoryViewProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (!emails || emails.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full text-muted-foreground">
                <Mail className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">Aucun email envoyé pour ce document.</p>
            </div>
        );
    }

    // Sort by date desc
    const sortedEmails = [...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate relance numbers (chronological)
    const chronologicalEmails = [...emails].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let relanceCount = 0;
    const relanceIndices = new Map<string, number>();
    chronologicalEmails.forEach(email => {
        if (email.actionType === 'relance') {
            relanceCount++;
            relanceIndices.set(email.id, relanceCount);
        }
    });

    const getActionIcon = (actionType: string) => {
        switch (actionType) {
            case 'envoi':
                return <Send className="h-4 w-4 text-blue-500" />;
            case 'relance':
                return <RefreshCw className="h-4 w-4 text-orange-500" />;
            case 'download':
                return <Download className="h-4 w-4 text-purple-500" />;
            default:
                return <Mail className="h-4 w-4" />;
        }
    };

    const getActionBadge = (email: EmailLog) => {
        const actionType = email.actionType || 'envoi';

        if (email.status === 'scheduled') {
            return <span className="text-[10px] px-2 py-0.5 rounded-full border bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Programmé</span>;
        }

        if (actionType === 'relance') {
            const index = relanceIndices.get(email.id) || 0;
            const label = index === 1 ? '1ère relance' : `${index}ème relance`;
            return <span className="text-[10px] px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-500 border-orange-500/20 whitespace-nowrap">{label}</span>;
        }

        if (actionType === 'download') {
            return <span className="text-[10px] px-2 py-0.5 rounded-full border bg-purple-500/10 text-purple-500 border-purple-500/20">Téléchargement</span>;
        }

        return <span className="text-[10px] px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-500 border-blue-500/20">Envoi</span>;
    };

    return (
        <div className="space-y-3">
            {sortedEmails.map((email) => {
                const isExpanded = expandedId === email.id;
                const canResend = email.status === 'sent' && (email.actionType === 'envoi' || email.actionType === 'relance');

                return (
                    <div key={email.id} className="glass-card rounded-lg border border-white/5 overflow-hidden transition-all hover:border-white/10">
                        {/* Header - Always visible */}
                        <button
                            onClick={() => setExpandedId(isExpanded ? null : email.id)}
                            className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Action Type Icon */}
                                <div className="mt-0.5 flex-shrink-0">
                                    {email.status === 'scheduled' ? <Clock className="h-4 w-4 text-yellow-500" /> : getActionIcon(email.actionType || 'envoi')}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h4 className="text-sm font-semibold text-foreground truncate">{email.subject}</h4>
                                        {getActionBadge(email)}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${email.status === 'sent' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                            email.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                email.status === 'scheduled' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                    'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                                            }`}>
                                            {email.status === 'sent' ? 'Envoyé' : email.status === 'failed' ? 'Échec' : email.status === 'scheduled' ? 'En attente' : 'Brouillon'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                        {email.actionType !== 'download' && <span className="truncate">À : {email.to}</span>}
                                        {email.actionType !== 'download' && <span>•</span>}
                                        <span className="flex-shrink-0">
                                            {email.status === 'scheduled' && email.scheduledAt
                                                ? `Prévu le ${format(new Date(email.scheduledAt), "d MMM yyyy à HH:mm", { locale: fr })}`
                                                : format(new Date(email.date), "d MMM yyyy à HH:mm", { locale: fr })
                                            }
                                        </span>
                                    </div>
                                    {email.attachments && email.attachments.length > 0 && (
                                        <div className="flex items-center gap-1 mt-2">
                                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground">
                                                {email.attachments.length} pièce{email.attachments.length > 1 ? 's' : ''} jointe{email.attachments.length > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Expand icon */}
                            <div className="flex-shrink-0 mt-1">
                                {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </button>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Message */}
                                {email.actionType !== 'download' && (
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
                                        <div className="text-xs text-foreground bg-black/20 p-3 rounded border border-white/5 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                                            {email.message}
                                        </div>
                                    </div>
                                )}

                                {/* Attachments Detail */}
                                {email.attachments && email.attachments.length > 0 && (
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Pièces jointes</label>
                                        <div className="flex flex-wrap gap-2">
                                            {email.attachments.map((att, i) => (
                                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] text-muted-foreground">
                                                    <Paperclip className="h-3 w-3" />
                                                    <span className="truncate max-w-[200px]">{att.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Resend button */}
                                {canResend && onResend && (
                                    <div className="pt-2 border-t border-white/5">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onResend(email);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition-all text-xs font-medium w-full justify-center"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                            Relancer ce message
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
