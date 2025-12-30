
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Mail, Save, AlertCircle, CheckCircle, Server, Globe } from "lucide-react";
import { useData } from "@/components/data-provider";
import { saveEmailConfiguration } from "@/lib/actions/email-settings";
import { toast } from "sonner";

interface EmailConfigForm {
    provider: "SMTP" | "GMAIL";
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    secure?: boolean;
    fromName?: string;
    fromEmail?: string;
    emailSignature?: string;
    invoiceTemplate?: { subject: string, message: string };
    quoteTemplate?: { subject: string, message: string };
}

export function EmailSettings() {
    const { societe: currentSociete, refreshData } = useData();
    const [isSaving, setIsSaving] = useState(false);

    // Derived state for templates
    const [invoiceSubject, setInvoiceSubject] = useState("");
    const [invoiceMessage, setInvoiceMessage] = useState("");
    const [quoteSubject, setQuoteSubject] = useState("");
    const [quoteMessage, setQuoteMessage] = useState("");

    const { register, handleSubmit, watch, setValue, reset } = useForm<EmailConfigForm>({
        defaultValues: {
            provider: "SMTP",
            port: 587,
            secure: true
        }
    });

    const provider = watch("provider");

    useEffect(() => {
        if (currentSociete) {
            // Parse existing templates
            let templates = { invoice: { subject: "", message: "" }, quote: { subject: "", message: "" } };
            try {
                if (currentSociete.emailTemplates) {
                    templates = JSON.parse(currentSociete.emailTemplates);
                }
            } catch (e) { }

            setInvoiceSubject(templates.invoice?.subject || `Facture {{numero}} de ${currentSociete.nom}`);
            setInvoiceMessage(templates.invoice?.message || `Bonjour,\n\nVeuillez trouver ci-joint la facture {{numero}}.\n\nCordialement,\n${currentSociete.nom}`);
            setQuoteSubject(templates.quote?.subject || `Devis {{numero}} de ${currentSociete.nom}`);
            setQuoteMessage(templates.quote?.message || `Bonjour,\n\nVeuillez trouver ci-joint le devis {{numero}}.\n\nCordialement,\n${currentSociete.nom}`);

            reset({
                provider: (currentSociete.emailProvider as "SMTP" | "GMAIL") || "SMTP",
                host: currentSociete.smtpHost || "",
                port: currentSociete.smtpPort || 587,
                user: currentSociete.smtpUser || "",
                pass: "", // Don't fill password for security, placeholder indicates if set?
                secure: currentSociete.smtpSecure || true,
                fromName: currentSociete.nom,
                fromEmail: currentSociete.smtpFrom || currentSociete.email || "",
                emailSignature: currentSociete.emailSignature || ""
            });
        }
    }, [currentSociete, reset]);

    const onSubmit = async (data: EmailConfigForm) => {
        if (!currentSociete) return;
        setIsSaving(true);
        try {
            // Pack templates
            const templates = {
                invoice: { subject: invoiceSubject, message: invoiceMessage },
                quote: { subject: quoteSubject, message: quoteMessage }
            };

            await saveEmailConfiguration(currentSociete.id, {
                ...data,
                emailTemplates: JSON.stringify(templates)
            });

            await refreshData();
            toast.success("Configuration enregistrée");
        } catch (e: any) {
            console.error(e);
            toast.error("Erreur: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl space-y-6">
                <div className="flex items-center gap-3 border-b border-border dark:border-white/10 pb-4">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                        <Mail className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Méthode d'envoi</h2>
                        <p className="text-sm text-muted-foreground">Comment souhaitez-vous envoyer vos emails ?</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setValue("provider", "SMTP")}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${provider === "SMTP" ? "bg-orange-500/10 border-orange-500/50 text-orange-500" : "bg-white/5 border-transparent hover:bg-white/10"}`}
                    >
                        <Server className="h-6 w-6" />
                        <span className="font-medium">Serveur SMTP</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setValue("provider", "GMAIL")}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${provider === "GMAIL" ? "bg-blue-500/10 border-blue-500/50 text-blue-500" : "bg-white/5 border-transparent hover:bg-white/10"}`}
                    >
                        <Globe className="h-6 w-6" />
                        <span className="font-medium">Gmail (OAuth)</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {provider === "SMTP" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Serveur SMTP</label>
                                    <input {...register("host")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" placeholder="smtp.gmail.com" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Port</label>
                                    <input {...register("port", { valueAsNumber: true })} type="number" className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" placeholder="587" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Utilisateur</label>
                                    <input {...register("user")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" placeholder="user@example.com" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Mot de passe</label>
                                    <input {...register("pass")} type="password" className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" placeholder="••••••••••••" />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input type="checkbox" {...register("secure")} id="secure" className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                                    <label htmlFor="secure" className="text-sm text-muted-foreground">Sécurisé (SSL/TLS)</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {provider === "GMAIL" && (
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center animate-in fade-in slide-in-from-top-2">
                            <p className="text-sm text-blue-200 mb-4">Connectez votre compte Google pour envoyer des emails via l'API Gmail.</p>

                            <button
                                type="button"
                                className="px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
                                onClick={() => {
                                    if (currentSociete) {
                                        window.location.href = `/api/auth/gmail?action=connect&societeId=${currentSociete.id}`;
                                    }
                                }}
                            >
                                Se connecter avec Google
                            </button>
                        </div>
                    )}

                    <div className="border-t border-border/50 pt-6">
                        <h3 className="text-sm font-semibold mb-4">Expéditeur & Signature</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Nom d'envoi</label>
                                <input {...register("fromName")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Email d'envoi</label>
                                <input {...register("fromEmail")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Signature (texte ou HTML simple)</label>
                            <textarea {...register("emailSignature")} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm h-20" placeholder="Cordialement, ..." />
                        </div>
                    </div>

                    <div className="border-t border-border/50 pt-6">
                        <h3 className="text-sm font-semibold mb-4">Modèles de message par défaut</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block text-blue-400">Pour les Factures</label>
                                <input
                                    value={invoiceSubject}
                                    onChange={(e) => setInvoiceSubject(e.target.value)}
                                    className="w-full glass-input px-4 py-2 rounded-xl text-sm mb-2"
                                    placeholder="Objet..."
                                />
                                <textarea
                                    value={invoiceMessage}
                                    onChange={(e) => setInvoiceMessage(e.target.value)}
                                    className="w-full glass-input px-4 py-2 rounded-xl text-sm h-24"
                                    placeholder="Message..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block text-purple-400">Pour les Devis</label>
                                <input
                                    value={quoteSubject}
                                    onChange={(e) => setQuoteSubject(e.target.value)}
                                    className="w-full glass-input px-4 py-2 rounded-xl text-sm mb-2"
                                    placeholder="Objet..."
                                />
                                <textarea
                                    value={quoteMessage}
                                    onChange={(e) => setQuoteMessage(e.target.value)}
                                    className="w-full glass-input px-4 py-2 rounded-xl text-sm h-24"
                                    placeholder="Message..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-lg shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {isSaving ? "..." : "Enregistrer la configuration"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
