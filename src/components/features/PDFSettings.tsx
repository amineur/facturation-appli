
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { FileText, Save, Columns, File, Table, Receipt } from "lucide-react"; // File = Devis icon approx, Receipt = Facture icon approx
import { useData } from "@/components/data-provider";
import { updateSociete } from "@/app/actions";
import { toast } from "sonner";
import { dataService } from "@/lib/data-service";
import { PdfTemplate, DEFAULT_PDF_TEMPLATE } from "@/types";

interface PDFConfigForm {
    mentionsLegales?: string;
    cgv?: string;
    // defaultConditions REMOVED per user request

    // Invoice Defaults
    invoiceShowDate?: boolean;
    invoiceShowQuantite?: boolean;
    invoiceShowTva?: boolean;
    invoiceShowRemise?: boolean;
    invoiceShowTtc?: boolean;

    // Quote Defaults
    quoteShowDate?: boolean;
    quoteShowQuantite?: boolean;
    quoteShowTva?: boolean;
    quoteShowRemise?: boolean;
    quoteShowTtc?: boolean;

    // Operation Type
    operationType?: 'none' | 'service' | 'goods';
}

export function PDFSettings() {
    const { societe: currentSociete, refreshData } = useData();
    const [isSaving, setIsSaving] = useState(false);

    // We don't load "template" state anymore for visual appearance as it was requested to be removed.
    // We only manage columns defaults which are stored in GlobalConfig.

    const { register, handleSubmit, reset, setValue } = useForm<PDFConfigForm>();

    useEffect(() => {
        // Load persistable societe data
        if (currentSociete) {
            setValue("mentionsLegales", currentSociete.mentionsLegales || "");
            setValue("cgv", currentSociete.cgv || "");
        }

        // Load Global Config Defaults
        const loadConfig = () => {
            const config = dataService.getGlobalConfig();

            // Invoice Defaults
            setValue("invoiceShowDate", config.invoiceDefaults?.showDate ?? false);
            setValue("invoiceShowQuantite", config.invoiceDefaults?.showQuantite ?? true);
            setValue("invoiceShowTva", config.invoiceDefaults?.showTva ?? true);
            setValue("invoiceShowRemise", config.invoiceDefaults?.showRemise ?? false);
            setValue("invoiceShowTtc", config.invoiceDefaults?.showTtc ?? false);

            // Quote Defaults
            setValue("quoteShowDate", config.quoteDefaults?.showDate ?? false);
            setValue("quoteShowQuantite", config.quoteDefaults?.showQuantite ?? true);
            setValue("quoteShowTva", config.quoteDefaults?.showTva ?? true);
            setValue("quoteShowRemise", config.quoteDefaults?.showRemise ?? false);
            setValue("quoteShowTtc", config.quoteDefaults?.showTtc ?? false);

            // Operation Type
            setValue("operationType", config.operationType ?? 'service');
        };
        loadConfig();
    }, [currentSociete, setValue]);

    const onSubmit = async (data: PDFConfigForm) => {
        if (!currentSociete) return;
        setIsSaving(true);
        try {
            // 1. Save Societe Data (Server) - Mentions & CGV
            await updateSociete({
                ...currentSociete,
                mentionsLegales: data.mentionsLegales || null,
                cgv: data.cgv || null,
                // defaultConditions removed implies we might want to clear it? Or just leave it if code relies on it elsewhere? 
                // User said "Supprimer Condition de paiement par défaut" from UI. If currentSociete has value, it's fine.
                // We won't update it here.
            });

            // 2. Save Global Defaults (Local / Client Service)
            const currentConfig = dataService.getGlobalConfig();
            const newConfig = {
                ...currentConfig,
                invoiceDefaults: {
                    showDate: data.invoiceShowDate ?? false,
                    showQuantite: data.invoiceShowQuantite ?? true,
                    showTva: data.invoiceShowTva ?? true,
                    showRemise: data.invoiceShowRemise ?? false,
                    showTtc: data.invoiceShowTtc ?? false
                },
                quoteDefaults: {
                    showDate: data.quoteShowDate ?? false,
                    showQuantite: data.quoteShowQuantite ?? true,
                    showTva: data.quoteShowTva ?? true,
                    showRemise: data.quoteShowRemise ?? false,
                    showTtc: data.quoteShowTtc ?? false
                },
                operationType: data.operationType ?? 'service'
            };
            dataService.saveGlobalConfig(newConfig);

            await refreshData();
            toast.success("Configuration PDF enregistrée");
        } catch (e: any) {
            console.error(e);
            toast.error("Erreur: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl space-y-8">
                <div className="flex items-center gap-3 border-b border-border dark:border-white/10 pb-4">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                        <FileText className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Paramètres PDF</h2>
                        <p className="text-sm text-muted-foreground">Configuration des documents générés</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                    {/* SECTION 1: COLONNES FACTURE */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-400">
                            <Receipt className="h-4 w-4" />
                            Colonnes affichées – Facture
                        </h3>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la date (Ligne)</span>
                                <input type="checkbox" {...register("invoiceShowDate")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la quantité</span>
                                <input type="checkbox" {...register("invoiceShowQuantite")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la TVA (Colonne)</span>
                                <input type="checkbox" {...register("invoiceShowTva")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la remise (Colonne)</span>
                                <input type="checkbox" {...register("invoiceShowRemise")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            {/* Optionnel: TTC si besoin 
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher Total TTC (Colonne)</span>
                                <input type="checkbox" {...register("invoiceShowTtc")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            */}
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

                    {/* SECTION 2: COLONNES DEVIS */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-purple-400">
                            <File className="h-4 w-4" />
                            Colonnes affichées – Devis
                        </h3>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la date (Ligne)</span>
                                <input type="checkbox" {...register("quoteShowDate")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la quantité</span>
                                <input type="checkbox" {...register("quoteShowQuantite")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la TVA (Colonne)</span>
                                <input type="checkbox" {...register("quoteShowTva")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm">Afficher la remise (Colonne)</span>
                                <input type="checkbox" {...register("quoteShowRemise")} className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500" />
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

                    {/* SECTION 3: MENTIONS */}
                    <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Type d'opération */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3">Type d'opération</h3>
                                <label className="text-xs font-medium text-muted-foreground ml-1 mb-1.5 block">
                                    Mention affichée sur les documents
                                </label>
                                <select
                                    {...register("operationType")}
                                    className="w-full glass-input px-3 py-2.5 rounded-xl text-sm bg-black/20"
                                >
                                    <option value="none">Aucun</option>
                                    <option value="service">Prestation de services (Défaut)</option>
                                    {/* Using "Vente de marchandises" as explicit counterpart or user's "Vente de biens" */}
                                    <option value="goods">Vente de biens</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-sm font-semibold mb-4">Mentions légales</h3>
                            <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">
                                Pied de page des documents
                            </label>
                            <textarea
                                {...register("mentionsLegales")}
                                className="w-full glass-input px-4 py-2.5 rounded-xl text-sm h-32"
                                placeholder="Ex: SARL au capital de 10 000€ - RCS Paris..."
                            />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold mb-4">Conditions Générales de Vente</h3>
                            <label className="text-xs font-medium text-muted-foreground ml-1 mb-1 block">
                                CGV (Texte complet)
                            </label>
                            <textarea
                                {...register("cgv")}
                                className="w-full glass-input px-4 py-2.5 rounded-xl text-sm h-32"
                                placeholder="Vos conditions générales de vente..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
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
