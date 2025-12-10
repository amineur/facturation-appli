import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Mail, Save, AlertCircle, CheckCircle } from "lucide-react";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { updateSociete } from "@/app/actions";
import { Societe } from "@/types";

interface SmtpFormData {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    fromName: string;
    fromEmail: string;
}

export function EmailSettings() {
    // Access the current active society
    const { societe: currentSociete, refreshData } = useData();
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

    const { register, handleSubmit, reset } = useForm<SmtpFormData>({
        defaultValues: {
            host: "",
            port: 587,
            user: "",
            pass: "",
            secure: false,
            fromName: "",
            fromEmail: ""
        }
    });

    // Update form when societe changes
    useEffect(() => {
        if (currentSociete) {
            reset({
                host: currentSociete.smtpHost || "",
                port: currentSociete.smtpPort || 587,
                user: currentSociete.smtpUser || "",
                pass: currentSociete.smtpPass || "",
                secure: currentSociete.smtpSecure || false,
                fromName: currentSociete.nom, // Sender name usually company name
                fromEmail: currentSociete.smtpFrom || currentSociete.email || ""
            });
        }
    }, [currentSociete, reset]);

    const onSubmit = async (data: SmtpFormData) => {
        setIsSaving(true);
        setStatus("idle");

        try {
            if (!currentSociete) return;

            const updatedSociete: any = {
                ...currentSociete,
                smtpHost: data.host,
                smtpPort: data.port,
                smtpUser: data.user,
                smtpPass: data.pass,
                smtpSecure: data.secure,
                smtpFrom: data.fromEmail
                // fromName is unused in schema currently, maybe stored implicitly or ignored
            };

            await updateSociete(updatedSociete);
            refreshData();

            // In a real app we might test connection here
            setTimeout(() => {
                setIsSaving(false);
                setStatus("success");
                setTimeout(() => setStatus("idle"), 3000);
            }, 800);
        } catch (e) {
            console.error(e);
            setIsSaving(false);
            setStatus("error");
        }
    };

    return (
        <div className="glass-card p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="p-2 rounded-lg bg-orange-500/10">
                    <Mail className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white">Configuration Email Société</h2>
                    <p className="text-sm text-muted-foreground">Configurez l'envoi d'emails pour <strong>{currentSociete?.nom}</strong>.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Nom de l'expéditeur</label>
                        <input
                            {...register("fromName")}
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                            placeholder="Ex: Mon Entreprise"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Email de l'expéditeur</label>
                        <input
                            {...register("fromEmail")}
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                            placeholder="contact@example.com"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Serveur SMTP</label>
                        <input
                            {...register("host", { required: true })}
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                            placeholder="smtp.gmail.com"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Port</label>
                        <input
                            {...register("port", { required: true, valueAsNumber: true })}
                            type="number"
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                            placeholder="587"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Utilisateur SMTP</label>
                        <input
                            {...register("user")}
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                            placeholder="user@example.com"
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">Mot de passe SMTP</label>
                        <input
                            {...register("pass")}
                            type="password"
                            className="w-full glass-input px-4 py-2.5 rounded-xl text-sm"
                            placeholder="••••••••••••"
                            autoComplete="new-password"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        {...register("secure")}
                        id="secure-smtp"
                        className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500"
                    />
                    <label htmlFor="secure-smtp" className="text-sm text-muted-foreground">Utiliser une connexion sécurisée (SSL/TLS)</label>
                </div>

                <div className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {status === "success" && (
                            <span className="text-green-400 text-sm flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" /> Enregistré
                            </span>
                        )}
                        {status === "error" && (
                            <span className="text-red-400 text-sm flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" /> Erreur
                            </span>
                        )}
                    </div>
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
    );
}
