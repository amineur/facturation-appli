import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    Send, Paperclip, X, Plus, User, Calendar, Clock, ChevronDown, ChevronRight,
    Bold, Italic, Underline, AlignLeft, List, Link, Image, Trash2, Smile, Type
} from "lucide-react";
import { addDays, nextMonday, setHours, setMinutes, startOfToday, format, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useData } from "@/components/data-provider";

interface EmailComposerProps {
    defaultTo: string;
    defaultSubject: string;
    defaultMessage: string;
    mainAttachmentName: string;

    onSend: (data: { to: string; subject: string; message: string; additionalAttachments: File[]; scheduledAt?: string }) => Promise<void>;
}

export function EmailComposer({
    defaultTo,
    defaultSubject,
    defaultMessage,
    mainAttachmentName,

    onSend
}: EmailComposerProps) {
    const { clients } = useData();
    const [recipients, setRecipients] = useState<string[]>(defaultTo ? [defaultTo] : []);
    const [subject, setSubject] = useState(defaultSubject);
    const [message, setMessage] = useState(defaultMessage);
    const [additionalAttachments, setAdditionalAttachments] = useState<File[]>([]);

    // Scheduling State
    const [showScheduleMenu, setShowScheduleMenu] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [customDateMode, setCustomDateMode] = useState(false);
    const [customDateValue, setCustomDateValue] = useState("");

    const [isSending, setIsSending] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowScheduleMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const emailInputRef = useRef<HTMLInputElement>(null);

    const [recipientInput, setRecipientInput] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);

    const suggestions = recipientInput.length > 0
        ? clients.filter(c =>
            c.email.toLowerCase().includes(recipientInput.toLowerCase()) &&
            !recipients.includes(c.email)
        ).slice(0, 5).map(c => c.email)
        : [];

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (['Enter', ',', ' Tab'].includes(e.key)) {
            e.preventDefault();
            addRecipient(recipientInput);
        }
        if (e.key === 'Backspace' && recipientInput === '' && recipients.length > 0) {
            removeRecipient(recipients.length - 1);
        }
    };

    const addRecipient = (email: string) => {
        const cleanEmail = email.trim().replace(/,$/, '');
        if (cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            if (!recipients.includes(cleanEmail)) {
                setRecipients([...recipients, cleanEmail]);
            }
            setRecipientInput("");
            setShowSuggestions(false);
        }
    };

    const removeRecipient = (index: number) => {
        setRecipients(recipients.filter((_, i) => i !== index));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAdditionalAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeAttachment = (index: number) => {
        setAdditionalAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e?: React.FormEvent, scheduledAt?: string) => {
        if (e) e.preventDefault();

        if (recipients.length === 0) {
            toast.error("Veuillez ajouter au moins un destinataire");
            return;
        }
        if (!subject || !message) {
            toast.error("Veuillez remplir tous les champs obligatoires");
            return;
        }

        setIsSending(true);
        try {
            await onSend({
                to: recipients.join(', '),
                subject,
                message,
                additionalAttachments,
                scheduledAt: scheduledAt || undefined
            });
            // Reset
            setAdditionalAttachments([]);
            setShowScheduleMenu(false);
            setShowScheduleModal(false);
            setCustomDateMode(false);
            setMessage("");
            setSubject(defaultSubject);
            setRecipients(defaultTo ? [defaultTo] : []);
        } catch (error) {
            console.error("Send error", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleSchedulePreset = (type: 'tomorrow-morning' | 'tomorrow-afternoon' | 'monday-morning') => {
        const today = startOfToday();
        let date = today;

        switch (type) {
            case 'tomorrow-morning':
                date = setHours(addDays(today, 1), 8);
                break;
            case 'tomorrow-afternoon':
                date = setHours(addDays(today, 1), 13);
                break;
            case 'monday-morning':
                date = setHours(nextMonday(today), 8);
                break;
        }

        handleSubmit(undefined, date.toISOString());
    };

    const handleCustomSchedule = () => {
        if (!customDateValue) {
            toast.error("Veuillez choisir une date");
            return;
        }
        handleSubmit(undefined, customDateValue);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background dark:bg-[#1e1e1e] text-foreground">
            {/* Fields Area */}
            <div className="px-4">
                {/* Recipients */}
                <div className="flex items-center gap-2 border-b border-border dark:border-white/10 min-h-[48px] py-1">
                    <span className="text-sm text-muted-foreground w-8">À</span>
                    <div className="flex-1 flex flex-wrap gap-2 items-center relative">
                        {recipients.map((email, index) => (
                            <div key={index} className="flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-medium">
                                <span>{email}</span>
                                <button type="button" onClick={() => removeRecipient(index)} className="hover:text-primary/70"><X className="h-3 w-3" /></button>
                            </div>
                        ))}
                        <input
                            ref={emailInputRef}
                            type="text"
                            value={recipientInput}
                            onChange={(e) => { setRecipientInput(e.target.value); setShowSuggestions(true); }}
                            onKeyDown={handleKeyDown}
                            onBlur={() => {
                                if (recipientInput) addRecipient(recipientInput);
                                setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            className="flex-1 min-w-[150px] bg-transparent border-none text-sm focus:ring-0 outline-none placeholder:text-muted-foreground/50"
                        />
                        {/* Suggestions */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-background dark:bg-[#2b2b2b] border border-border dark:border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {suggestions.map((email, index) => {
                                    const client = clients.find(c => c.email === email);
                                    return (
                                        <button key={index} type="button" onClick={() => addRecipient(email)} className="w-full px-4 py-2 text-left hover:bg-white/5 flex items-center gap-2 text-sm">
                                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px]">{client?.nom.substring(0, 2).toUpperCase()}</div>
                                            <div className="truncate flex-1">{email}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Cc Cci</div>
                </div>

                {/* Subject */}
                <div className="flex items-center border-b border-border dark:border-white/10 h-[48px]">
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-transparent border-none text-sm focus:ring-0 outline-none placeholder:text-muted-foreground"
                        placeholder="Objet"
                    />
                </div>
            </div>

            {/* Message Body */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 w-full bg-transparent p-4 text-sm resize-none focus:ring-0 outline-none leading-relaxed font-sans"
                    placeholder=""
                />
            </div>

            {/* Attachments List */}
            {/* Attachments List */}
            {(mainAttachmentName || additionalAttachments.length > 0) && (
                <div className="px-4 pb-2 flex flex-wrap gap-2">
                    {mainAttachmentName && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400 font-medium" title="Pièce jointe principale (Facture)">
                            <Paperclip className="h-3 w-3" />
                            {mainAttachmentName}
                        </div>
                    )}
                    {additionalAttachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-muted-foreground">
                            <span>{file.name}</span>
                            <button type="button" onClick={() => removeAttachment(index)} className="hover:text-red-400"><X className="h-3 w-3" /></button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer Toolbar */}
            <div className="p-3 flex items-center justify-between border-t border-border dark:border-white/10 bg-muted/30 dark:bg-[#1e1e1e]">
                <div className="flex items-center gap-2">
                    {/* Split Send Button */}
                    <div className="flex items-center relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e)}
                            disabled={isSending || recipients.length === 0}
                            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 rounded-l-full"
                        >
                            {isSending ? "Envoi..." : "Envoyer"}
                        </button>
                        <div className="h-full w-[1px] bg-blue-800 absolute right-[36px] top-0 bottom-0 pointer-events-none z-10 hidden" />
                        {/* Separator style is tricky, simplified */}
                        <button
                            type="button"
                            disabled={isSending || recipients.length === 0}
                            onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                            className="bg-blue-600 h-full px-2 hover:bg-blue-700 flex items-center justify-center border-l border-blue-800 rounded-r-full"
                            style={{ height: '36px' }} // Match height
                        >
                            <ChevronDown className="h-4 w-4 text-white" />
                        </button>

                        {/* Dropdown Menu */}
                        {showScheduleMenu && (
                            <div className="absolute left-0 bottom-full mb-2 w-56 bg-background/95 backdrop-blur-xl border border-border dark:border-white/10 rounded-lg shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    type="button"
                                    onClick={() => { setShowScheduleMenu(false); setShowScheduleModal(true); setCustomDateMode(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-white/5 transition-colors flex items-center gap-3"
                                >
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    Programmer l'envoi
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Toolbar Icons */}
                    <div className="flex items-center gap-1 ml-2 text-muted-foreground">
                        <button type="button" className="p-2 hover:bg-white/5 rounded-full"><Type className="h-4 w-4" /></button>
                        <button type="button" className="p-2 hover:bg-white/5 rounded-full" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4" /></button>
                        <button type="button" className="p-2 hover:bg-white/5 rounded-full"><Link className="h-4 w-4" /></button>
                        <button type="button" className="p-2 hover:bg-white/5 rounded-full"><Smile className="h-4 w-4" /></button>
                        <button type="button" className="p-2 hover:bg-white/5 rounded-full"><Image className="h-4 w-4" /></button>
                        <button type="button" className="p-2 hover:bg-white/5 rounded-full"><Clock className="h-4 w-4" /></button> {/* Confidential mode */}
                        <button type="button" className="p-2 hover:bg-white/5 rounded-full"><Bold className="h-4 w-4" /></button> {/* Signature */}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
                </div>

                {/* Trash */}
                <button type="button" onClick={() => { setAdditionalAttachments([]); setMessage(""); setSubject(""); }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* Scheduling Modal - Portal */}
            {showScheduleModal && mounted && (() => {
                const portalRoot = document.getElementById('glass-portal-root');
                if (!portalRoot) return null;
                return createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div ref={modalRef} className="w-full max-w-sm bg-background/95 backdrop-blur-xl border border-border dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Same Modal Content as before */}
                            <div className="p-4 border-b border-border dark:border-white/10 flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Programmer l'envoi</h3>
                                <button onClick={() => setShowScheduleModal(false)}>
                                    <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                                </button>
                            </div>
                            {!customDateMode ? (
                                <div className="py-2">
                                    <div className="px-4 pb-2"><p className="text-xs text-muted-foreground">Heure normale d'Europe centrale</p></div>
                                    <button onClick={() => handleSchedulePreset('tomorrow-morning')} className="w-full text-left px-6 py-3 hover:bg-white/5 flex justify-between items-center text-sm group">
                                        <span>Demain matin</span> <span className="text-muted-foreground">{format(setHours(addDays(new Date(), 1), 8), "d MMM HH:mm", { locale: fr })}</span>
                                    </button>
                                    <button onClick={() => handleSchedulePreset('tomorrow-afternoon')} className="w-full text-left px-6 py-3 hover:bg-white/5 flex justify-between items-center text-sm group">
                                        <span>Demain après-midi</span> <span className="text-muted-foreground">{format(setHours(addDays(new Date(), 1), 13), "d MMM HH:mm", { locale: fr })}</span>
                                    </button>
                                    <button onClick={() => handleSchedulePreset('monday-morning')} className="w-full text-left px-6 py-3 hover:bg-white/5 flex justify-between items-center text-sm group">
                                        <span>Lundi matin</span> <span className="text-muted-foreground">{format(setHours(nextMonday(new Date()), 8), "d MMM HH:mm", { locale: fr })}</span>
                                    </button>
                                    <div className="my-2 border-t border-white/5" />
                                    <button onClick={() => setCustomDateMode(true)} className="w-full text-left px-6 py-3 hover:bg-white/5 flex items-center gap-3 text-sm">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        Choisir une date et une heure
                                    </button>
                                </div>
                            ) : (
                                <div className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Date et heure personnalisées</label>
                                        <input type="datetime-local" value={customDateValue} onChange={(e) => setCustomDateValue(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setCustomDateMode(false)} className="px-4 py-2 text-sm hover:bg-white/10 rounded-lg transition-colors">Retour</button>
                                        <button onClick={handleCustomSchedule} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Programmer</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>,
                    portalRoot
                )
            })()}
        </form>
    );
}
