"use client";

import { useData } from "@/components/data-provider";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Send, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { useRouter } from "next/navigation";
import { sendInvoiceEmail } from "@/app/actions";

interface MobileEmailComposerProps {
    id: string;
    type: "FACTURE" | "DEVIS";
}

export function MobileEmailComposer({ id, type }: MobileEmailComposerProps) {
    const router = useRouter();
    const { invoices, quotes, clients, societe } = useData();
    const doc = type === "FACTURE" ? invoices.find(i => i.id === id) : quotes.find(q => q.id === id);

    if (!doc) return <div>Document introuvable</div>;
    const client = clients.find(c => c.id === doc.clientId);

    const [subject, setSubject] = useState(`${type === "FACTURE" ? "Facture" : "Devis"} ${doc.numero} - ${societe?.nom}`);
    const [message, setMessage] = useState(`Bonjour ${client?.nom || ""},\n\nVeuillez trouver ci-joint ${type === "FACTURE" ? "la facture" : "le devis"} ${doc.numero}.\n\nCordialement,\n${societe?.nom || ""}`);
    const [emailTo, setEmailTo] = useState(client?.email || "");
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!emailTo) {
            toast.error("Veuillez saisir une adresse email");
            return;
        }

        setIsSending(true);
        try {
            // Using the server action directly
            const result = await sendInvoiceEmail(
                id,
                type === "FACTURE" ? "invoice" : "quote",
                emailTo,
                subject,
                message,
                true // Attach PDF
            );

            if (result.success) {
                toast.success("Email envoyé !");
                router.back();
            } else {
                toast.error("Erreur lors de l'envoi");
                console.error(result.error);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erreur technique");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-muted/10 pb-24">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <span className="font-bold text-sm">Nouvel Email</span>
                <div className="w-10" />
            </div>

            <div className="p-4 space-y-6">
                <div className="space-y-4 bg-card p-4 rounded-xl border">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">À</label>
                        <input
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            className="w-full bg-transparent border-b border-border/50 py-2 text-sm focus:outline-none focus:border-primary"
                            placeholder="client@exemple.com"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Objet</label>
                        <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full bg-transparent border-b border-border/50 py-2 text-sm focus:outline-none focus:border-primary font-medium"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={10}
                            className="w-full bg-transparent border-0 py-2 text-sm focus:outline-none resize-none"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-500/10 text-blue-500 rounded-lg text-xs font-medium border border-blue-500/20">
                    <span className="shrink-0 text-lg">📎</span>
                    <span>Le PDF {doc.numero} sera automatiquement joint.</span>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border flex gap-3 z-[60]">
                <button
                    onClick={() => router.back()}
                    className="flex-1 py-3 font-medium text-muted-foreground active:scale-95 transition-transform"
                >
                    Annuler
                </button>
                <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="flex-[2] bg-primary text-black font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Send className="h-4 w-4" />
                    {isSending ? "Envoi..." : "Envoyer"}
                </button>
            </div>
        </div>
    );
}
