import { useState, useEffect } from "react";
import { X, Send, Paperclip, Mail } from "lucide-react";

interface EmailSenderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (emailData: { to: string; subject: string; message: string }) => Promise<void>;
    defaultEmail: string;
    defaultSubject: string;
    attachmentName: string;
}

export function EmailSenderModal({
    isOpen,
    onClose,
    onSend,
    defaultEmail,
    defaultSubject,
    attachmentName
}: EmailSenderModalProps) {
    const [to, setTo] = useState(defaultEmail);
    const [subject, setSubject] = useState(defaultSubject);
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTo(defaultEmail);
            setSubject(defaultSubject);
            setMessage(`Bonjour,\n\nVeuillez trouver ci-joint ${attachmentName}.\n\nCordialement,`);
        }
    }, [isOpen, defaultEmail, defaultSubject, attachmentName]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        try {
            await onSend({ to, subject, message });
            onClose();
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background glass-card w-full max-w-lg rounded-xl shadow-xl dark:shadow-2xl overflow-hidden border border-neutral-200 dark:border-white/10 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-white/10 bg-muted/20 dark:bg-primary/5">
                    <div className="flex items-center gap-2 text-primary">
                        <Mail className="h-5 w-5" />
                        <h3 className="font-semibold">Envoyer par email</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* To */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase">À</label>
                        <input
                            type="email"
                            required
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="w-full h-10 rounded-lg glass-input px-3 text-sm text-foreground focus:ring-1 focus:ring-primary/50 border-neutral-200 dark:border-white/10"
                            placeholder="email@client.com"
                        />
                    </div>

                    {/* Subject */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Objet</label>
                        <input
                            type="text"
                            required
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full h-10 rounded-lg glass-input px-3 text-sm text-foreground focus:ring-1 focus:ring-primary/50 border-neutral-200 dark:border-white/10"
                            placeholder="Sujet de l'email"
                        />
                    </div>

                    {/* Message */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Message</label>
                        <textarea
                            required
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={6}
                            className="w-full rounded-lg glass-input p-3 text-sm text-foreground focus:ring-1 focus:ring-primary/50 border-neutral-200 dark:border-white/10 resize-none"
                            placeholder="Votre message..."
                        />
                    </div>

                    {/* Attachment */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Paperclip className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{attachmentName}</p>
                            <p className="text-xs text-muted-foreground">PDF généré automatiquement</p>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSending}
                            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSending ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Envoi...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Envoyer
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
