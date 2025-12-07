"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray, Control, useWatch, FormProvider } from "react-hook-form";
import { Plus, Trash2, Calendar as CalendarIcon, Save, Send, Download, Check, ChevronsUpDown, X, Search, ArrowLeft, Eye, Tag, Settings, Type, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Facture, Devis, Client, LigneItem, Produit, Societe, StatusFacture } from "@/types";
import { Reorder } from "framer-motion";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { useRouter } from "next/navigation";
import { generateNextInvoiceNumber, generateNextQuoteNumber } from "@/lib/invoice-utils";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";
import { InvoiceLineItem } from "./InvoiceLineItem";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

import Link from "next/link";

interface InvoiceFormValues {
    numero: string;
    clientId: string;
    dateEmission: string;
    echeance: string;
    conditionsPaiement?: string;
    numeroEnregistrement?: string;
    codeService?: string;
    remiseGlobale?: number;
    remiseGlobaleType?: 'pourcentage' | 'montant';
    items: LigneItem[];
}

export function InvoiceEditor({ type = "Facture", initialData }: { type?: "Facture" | "Devis", initialData?: Facture | Devis }) {
    const { clients, products, refreshData, societe, invoices, quotes } = useData();
    const router = useRouter();

    // Generate next invoice/quote number
    const getNextNumber = () => {
        if (initialData?.numero) return initialData.numero; // Keep existing number when editing
        return type === "Facture"
            ? generateNextInvoiceNumber(invoices)
            : generateNextQuoteNumber(quotes);
    };

    const methods = useForm<InvoiceFormValues>({
        defaultValues: {
            numero: getNextNumber(),
            dateEmission: new Date().toISOString().split("T")[0],
            conditionsPaiement: "30 jours", // Default to 30 days

            ...initialData, // Apply initial data if provided
            // Ensure items are correctly initialized if initialData has them
            items: initialData?.items || [{ description: "", quantite: 1, prixUnitaire: 0, tva: 20, totalLigne: 0, produitId: "", type: 'produit' }]
        }
    });

    const { register, control, handleSubmit, setValue, watch, getValues, formState: { errors } } = methods;

    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: "items"
    });

    const [isClientOpen, setIsClientOpen] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    // Load Global Config for defaults if not editing specific invoice config
    const globalConfig = dataService.getGlobalConfig();

    // Column visibility states - Loaded from saved config or defaults
    const [showDateColumn, setShowDateColumn] = useState(initialData?.config?.showDateColumn ?? globalConfig.showDateColumn ?? false);
    const [showTTCColumn, setShowTTCColumn] = useState(initialData?.config?.showTTCColumn ?? globalConfig.showTTCColumn ?? false);
    const [discountEnabled, setDiscountEnabled] = useState(initialData?.config?.discountEnabled ?? globalConfig.discountEnabled ?? false);
    const [discountType, setDiscountType] = useState<'pourcentage' | 'montant'>(initialData?.config?.discountType || globalConfig.discountType || 'pourcentage');
    const [globalDiscountType, setGlobalDiscountType] = useState<'pourcentage' | 'montant'>(initialData?.remiseGlobaleType || 'pourcentage');
    const [defaultTva, setDefaultTva] = useState(initialData?.config?.defaultTva ?? globalConfig.defaultTva ?? 20); // Default VAT rate
    const [showOptionalFields, setShowOptionalFields] = useState(initialData?.config?.showOptionalFields ?? globalConfig.showOptionalFields ?? false);
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [editedClientData, setEditedClientData] = useState<Partial<Client>>({});
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Auto-calculate due date based on payment terms
    const watchDateEmission = useWatch({ control, name: "dateEmission" });
    const watchConditionsPaiement = useWatch({ control, name: "conditionsPaiement" });

    useEffect(() => {
        if (watchDateEmission && watchConditionsPaiement) {
            const emissionDate = new Date(watchDateEmission);
            let daysToAdd = 30; // Default

            // Extract number of days from payment terms
            const match = watchConditionsPaiement.match(/(\d+)/);
            if (match) {
                daysToAdd = parseInt(match[1]);
            } else if (watchConditionsPaiement === "À réception") {
                daysToAdd = 0;
            }

            const dueDate = new Date(emissionDate);
            dueDate.setDate(dueDate.getDate() + daysToAdd);
            setValue("echeance", dueDate.toISOString().split("T")[0]);
        }
    }, [watchDateEmission, watchConditionsPaiement, setValue]);

    // Preview state
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Watch items and global discount to calculate totals real-time
    const watchedItems = useWatch({ control, name: "items" });
    const watchedRemiseGlobale = useWatch({ control, name: "remiseGlobale" }) || 0;
    const watchedRemiseGlobaleType = useWatch({ control, name: "remiseGlobaleType" }) || 'pourcentage';

    const [totals, setTotals] = useState({
        ht: 0,
        htAvantRemiseGlobale: 0,
        remiseLignes: 0,
        remiseGlobale: 0,
        tva: 0,
        ttc: 0
    });

    // Close settings on click outside
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };

        if (isSettingsOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isSettingsOpen]);

    // Clear line discounts when disabled
    useEffect(() => {
        if (!discountEnabled) {
            setValue("items", watchedItems.map(item => ({ ...item, remise: 0 })));
        }
    }, [discountEnabled]); // Only depend on enabled state to avoid loop

    useEffect(() => {
        // 1. Calculate line totals (HT before global discount)
        let htAvantRemiseGlobale = 0;
        let remiseLignesTotal = 0;

        watchedItems.forEach(item => {
            const montantAvantRemise = (item.quantite || 0) * (item.prixUnitaire || 0);
            let remiseLigne = 0;

            if (discountEnabled && item.remise && item.remise > 0) {
                // Determine remise type: use item-specific if set, otherwise global setting
                // For now, UI forces global setting, but data model supports item specific
                // We'll rely on global setting `discountType` for now as per UI controls,
                // but if we wanted item-specific, we'd check item.remiseType.
                // Assuming `discountType` state controls interpretation.
                // Actually, let's respect the item's `remiseType` if it was set during edit.
                // BUT, to fix user issue, we must ensure if disabled, it is 0.
                // We handled that in the effect above. Here we just compute.

                const type = item.remiseType || discountType;
                if (type === 'montant') {
                    remiseLigne = item.remise;
                } else {
                    remiseLigne = montantAvantRemise * ((item.remise || 0) / 100);
                }
            }

            remiseLignesTotal += remiseLigne;
            htAvantRemiseGlobale += Math.max(0, montantAvantRemise - remiseLigne); // Ensure no negative line totals
        });

        // 2. Calculate Global Discount Amount
        let remiseGlobaleMontant = 0;
        if (watchedRemiseGlobale && watchedRemiseGlobale > 0) {
            if (watchedRemiseGlobaleType === 'montant') {
                remiseGlobaleMontant = watchedRemiseGlobale;
            } else {
                remiseGlobaleMontant = htAvantRemiseGlobale * (watchedRemiseGlobale / 100);
            }
        }

        // 3. Calculate Discount Ratio for VAT distribution
        // If HT is 0, ratio is 1 (no discount effect). 
        // We clamp ratio to 0 to avoid negative VAT if discount > total.
        const globalDiscountRatio = htAvantRemiseGlobale > 0
            ? Math.max(0, 1 - (remiseGlobaleMontant / htAvantRemiseGlobale))
            : 1;

        // 4. Calculate Net HT
        const htNet = Math.max(0, htAvantRemiseGlobale - remiseGlobaleMontant);

        // 5. Calculate VAT
        // We apply the global discount ratio to each line's Net HT before applying VAT rate
        const tva = watchedItems.reduce((acc, item) => {
            const montantAvantRemise = (item.quantite || 0) * (item.prixUnitaire || 0);

            let remiseLigne = 0;
            if (discountEnabled && item.remise && item.remise > 0) {
                const type = item.remiseType || discountType;
                if (type === 'montant') {
                    remiseLigne = item.remise;
                } else {
                    remiseLigne = montantAvantRemise * ((item.remise || 0) / 100);
                }
            }

            const montantLigneNetDeRemiseLigne = Math.max(0, montantAvantRemise - remiseLigne);

            // Apply global discount ratio
            const montantLigneFinal = montantLigneNetDeRemiseLigne * globalDiscountRatio;

            return acc + (montantLigneFinal * ((item.tva || 0) / 100));
        }, 0);

        setTotals({
            ht: htNet,
            htAvantRemiseGlobale,
            remiseLignes: remiseLignesTotal,
            remiseGlobale: remiseGlobaleMontant,
            tva,
            ttc: htNet + tva
        });
    }, [watchedItems, watchedRemiseGlobale, watchedRemiseGlobaleType]);

    const handleProductChange = (index: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setValue(`items.${index}.description`, product.nom);
            setValue(`items.${index}.prixUnitaire`, product.prixUnitaire);
            setValue(`items.${index}.tva`, product.tva);
        }
    };

    const handleDescriptionChange = (index: number, value: string) => {
        setValue(`items.${index}.description`, value);

        // Check if the entered text matches a product name
        const matchingProduct = products.find(p => p.nom.toLowerCase() === value.toLowerCase());
        if (matchingProduct) {
            setValue(`items.${index}.prixUnitaire`, matchingProduct.prixUnitaire);
            setValue(`items.${index}.tva`, matchingProduct.tva);
            setValue(`items.${index}.produitId`, matchingProduct.id);
        }
    };

    const onSubmit = async (data: InvoiceFormValues) => {
        try {
            setIsSaving(true);

            // Validate required fields
            if (!data.clientId) {
                alert("Veuillez sélectionner un client.");
                setIsSaving(false);
                return;
            }

            if (!data.items || data.items.length === 0) {
                alert("Veuillez ajouter au moins une ligne.");
                setIsSaving(false);
                return;
            }

            // Construct document
            const documentData = {
                id: initialData?.id || crypto.randomUUID(),
                ...data,
                totalHT: totals.ht,
                totalTVA: totals.tva,
                totalTTC: totals.ttc,
                config: {
                    showDateColumn,
                    showTTCColumn,
                    discountEnabled,
                    discountType,
                    defaultTva,
                    showOptionalFields
                },
                remiseGlobale: data.remiseGlobale || 0,
                remiseGlobaleMontant: totals.remiseGlobale,
                clientId: data.clientId,
                societeId: societe.id,
                items: data.items.map(item => ({
                    id: crypto.randomUUID(),
                    ...item
                })),
                ...(type === "Facture" ? {
                    type: "Facture",
                    statut: initialData?.statut || "Brouillon",
                    echeance: data.echeance || "",
                    datePaiement: (initialData as Facture)?.datePaiement,
                    acomptes: (initialData as Facture)?.acomptes || [],
                    totalAcomptes: 0,
                    resteAPayer: totals.ttc
                } : {
                    statut: initialData?.statut || "Brouillon",
                    dateValidite: (data as any).dateValidite || ""
                })
            } as unknown as Facture | Devis;

            if (type === "Facture") {
                dataService.saveInvoice(documentData as Facture);
            } else {
                dataService.saveQuote(documentData as Devis);
            }

            refreshData();

            // Simulate a brief delay to show the loading state
            await new Promise(resolve => setTimeout(resolve, 500));

            alert(`${type} enregistré${type === "Facture" ? "e" : ""} avec succès !`);
            router.push(type === "Facture" ? "/factures" : "/devis");
        } catch (error) {
            console.error("Error saving:", error);
            alert("Erreur lors de l'enregistrement. Veuillez réessayer.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePDF = () => {
        const formData = watch();
        const client = clients.find(c => c.id === formData.clientId);

        if (!client || !societe) {
            alert("Veuillez sélectionner un client.");
            return;
        }

        // Construct a temporary document object for generation
        // Note: In a real app we might want to save first or use a proper type adjusted for "preview"
        const documentData = {
            id: initialData?.id || "temp",
            ...formData,
            // Calculate totals freshly to be sure
            totalHT: totals.ht,
            totalTVA: totals.tva,
            totalTTC: totals.ttc,
            // Ensure type specific fields exist
            ...(type === "Facture" ? { statut: "Brouillon", echeance: (formData as any).echeance || "" } : { statut: "Brouillon", dateValidite: (formData as any).dateValidite || "" })
        } as unknown as Facture | Devis; // Casting for simplicity in this mock context

        generateInvoicePDF(documentData, societe, client, {});
    };



    const handlePreview = () => {
        const formData = watch();
        const client = clients.find(c => c.id === formData.clientId);

        if (!client) {
            alert("Veuillez sélectionner un client");
            return;
        }

        if (!societe) {
            alert("Informations de la société manquantes");
            return;
        }

        const documentData = {
            id: initialData?.id || "temp",
            ...formData,
            totalHT: totals.ht,
            totalTVA: totals.tva,
            totalTTC: totals.ttc,
            config: {
                showDateColumn,
                showTTCColumn,
                discountEnabled
            },
            ...(type === "Facture" ? { statut: "Brouillon", echeance: (formData as any).echeance || "" } : { statut: "Brouillon", dateValidite: (formData as any).dateValidite || "" })
        } as unknown as Facture | Devis;

        const url = generateInvoicePDF(documentData, societe, client, {
            returnBlob: true
        });
        if (url && typeof url === 'string') {
            setPreviewUrl(url);
            setIsPreviewOpen(true);
        }
    };

    // Derived state for filtered clients
    const filteredClients = clients.filter(client =>
        client.nom.toLowerCase().includes(clientSearch.toLowerCase())
    );

    // Get selected client name for display
    const selectedClientId = watch("clientId");
    const selectedClient = clients.find(c => c.id === selectedClientId);

    const isEditMode = !!initialData?.id;
    const pageTitle = type === "Facture"
        ? (isEditMode ? "Modifier la Facture" : "Nouvelle Facture")
        : (isEditMode ? "Modifier le Devis" : "Nouveau Devis");

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {isEditMode && (
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="p-2 text-muted-foreground hover:text-foreground glass rounded-lg transition-colors"
                                title="Retour"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground">{pageTitle}</h2>
                            <p className="text-gray-400 mt-1">Édition en cours</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative" ref={settingsRef}>
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className="p-2 text-muted-foreground hover:text-foreground glass rounded-lg transition-colors cursor-pointer"
                            >
                                <Settings className="h-5 w-5" />
                            </button>
                            {isSettingsOpen && (
                                <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
                                    <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                        <Settings className="h-4 w-4" />
                                        Configuration
                                    </h4>

                                    <div className="space-y-4">
                                        {/* Columns Configuration */}
                                        <div className="space-y-2">
                                            <label className="text-xs text-muted-foreground font-medium uppercase">Affichage des colonnes</label>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground">Date de la prestation</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={showDateColumn}
                                                        onChange={(e) => setShowDateColumn(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground">Prix TTC</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={showTTCColumn}
                                                        onChange={(e) => setShowTTCColumn(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground">Remises</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={discountEnabled}
                                                        onChange={(e) => setDiscountEnabled(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                                </label>
                                            </div>
                                        </div>

                                        {discountEnabled && (
                                            <>
                                                <div className="h-px bg-white/10" />

                                                {/* Line Discount Type */}
                                                <div className="space-y-2">
                                                    <label className="text-xs text-muted-foreground font-medium uppercase">Type de remise (Lignes)</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (discountType !== 'pourcentage') {
                                                                    setDiscountType('pourcentage');
                                                                    // Update type but keep value
                                                                    const newItems = watchedItems.map(item => ({
                                                                        ...item,
                                                                        remiseType: 'pourcentage' as const
                                                                    }));
                                                                    setValue("items", newItems);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                                                                discountType === 'pourcentage'
                                                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                                                    : "text-muted-foreground border-white/10 hover:bg-white/5"
                                                            )}
                                                        >
                                                            Pourcentage (%)
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (discountType !== 'montant') {
                                                                    setDiscountType('montant');
                                                                    // Update type but keep value
                                                                    const newItems = watchedItems.map(item => ({
                                                                        ...item,
                                                                        remiseType: 'montant' as const
                                                                    }));
                                                                    setValue("items", newItems);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                                                                discountType === 'montant'
                                                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                                                    : "text-muted-foreground border-white/10 hover:bg-white/5"
                                                            )}
                                                        >
                                                            Montant (€)
                                                        </button>
                                                    </div>
                                                </div>


                                            </>
                                        )}

                                        <div className="flex items-center justify-between py-2 border-b border-white/10">
                                            <span className="text-sm font-medium text-foreground">TVA par défaut</span>
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-24">
                                                    <input
                                                        type="number"
                                                        value={defaultTva}
                                                        onChange={(e) => {
                                                            const newVal = parseFloat(e.target.value) || 0;
                                                            setDefaultTva(newVal);
                                                            // Update all items
                                                            const currentItems = getValues("items");
                                                            if (currentItems) {
                                                                const updatedItems = currentItems.map((item: LigneItem) => ({ ...item, tva: newVal }));
                                                                setValue("items", updatedItems);
                                                            }
                                                        }}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-right text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500 pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handlePreview}
                            className="p-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 glass rounded-lg transition-colors cursor-pointer"
                            title="Aperçu PDF"
                        >
                            <Eye className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleGeneratePDF}
                            className="p-2 text-muted-foreground hover:text-foreground glass rounded-lg transition-colors cursor-pointer"
                            title="Télécharger PDF"
                        >
                            <Download className="h-5 w-5" />
                        </button>
                        <button type="button" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer">
                            <Send className="h-4 w-4" />
                            Envoyer
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit(onSubmit)}
                            disabled={isSaving}
                            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-emerald-600"
                        >
                            {isSaving ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Enregistrement...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Enregistrer
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="glass-card rounded-xl p-8 space-y-8">

                    {/* Header: Client & Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 relative">
                            <label className="block text-sm font-medium text-muted-foreground">Client</label>

                            {/* Custom Combobox */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsClientOpen(!isClientOpen)}
                                    className="w-full h-11 rounded-lg glass-input px-4 text-foreground text-left flex items-center justify-between focus:ring-1 focus:ring-white/20"
                                >
                                    <span className={!selectedClient ? "text-muted-foreground" : ""}>
                                        {selectedClient ? selectedClient.nom : "Sélectionner un client..."}
                                    </span>
                                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                                </button>

                                {isClientOpen && (
                                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        <div className="p-2 border-b border-white/5">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Rechercher..."
                                                    value={clientSearch}
                                                    onChange={(e) => setClientSearch(e.target.value)}
                                                    className="w-full h-9 rounded-md bg-white/5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground border-none focus:ring-1 focus:ring-white/20"
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto p-1">
                                            {filteredClients.length === 0 ? (
                                                <div className="p-3 text-center text-sm text-muted-foreground">
                                                    Aucun client trouvé.
                                                </div>
                                            ) : (
                                                filteredClients.map(client => (
                                                    <button
                                                        key={client.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setValue("clientId", client.id);
                                                            setIsClientOpen(false);
                                                            setClientSearch("");
                                                        }}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between group transition-colors",
                                                            selectedClientId === client.id
                                                                ? "bg-emerald-500/20 text-emerald-500"
                                                                : "text-foreground hover:bg-white/10"
                                                        )}
                                                    >
                                                        {client.nom}
                                                        {selectedClientId === client.id && (
                                                            <Check className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-2 border-t border-white/5 bg-white/5">
                                            <Link
                                                href="/clients/new"
                                                className="w-full px-3 py-2 rounded-md text-sm flex items-center gap-2 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Créer un nouveau client
                                            </Link>
                                        </div>
                                    </div>
                                )}

                                {/* Hidden select for form registration/validation if needed, or just rely on setValue above */}
                                <input type="hidden" {...register("clientId", { required: true })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Numéro</label>
                                <input {...register("numero")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Date d'émission</label>
                                <input type="date" {...register("dateEmission")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Échéance</label>
                                <input type="date" {...register("echeance")} className="w-full h-11 rounded-lg glass-input px-4 text-foreground" />
                            </div>
                        </div>

                        {/* Optional Fields Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowOptionalFields(!showOptionalFields)}
                            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <ChevronsUpDown className="h-4 w-4" />
                            {showOptionalFields ? "Masquer" : "Afficher"} les informations complémentaires
                        </button>

                        {showOptionalFields && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-muted-foreground">Conditions de paiement</label>
                                        <select
                                            {...register("conditionsPaiement")}
                                            className="w-full h-11 rounded-lg glass-input px-4 text-foreground cursor-pointer"
                                        >
                                            <option value="">Sélectionner...</option>
                                            <option value="À réception">À réception</option>
                                            <option value="15 jours">15 jours</option>
                                            <option value="30 jours">30 jours</option>
                                            <option value="45 jours">45 jours</option>
                                            <option value="60 jours">60 jours</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-muted-foreground">Numéro d'enregistrement</label>
                                        <input
                                            {...register("numeroEnregistrement")}
                                            placeholder="Ex : RC123456"
                                            className="w-full h-11 rounded-lg glass-input px-4 text-foreground"
                                        />
                                    </div>
                                </div>

                                {/* Client Billing Information */}
                                {selectedClient && (
                                    <div className="glass-card rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                Informations de facturation
                                            </h4>
                                            {!isEditingClient ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsEditingClient(true);
                                                        setIsEditingClient(true);
                                                        setEditedClientData({
                                                            nom: selectedClient.nom,
                                                            prenomContact: selectedClient.prenomContact,
                                                            nomContact: selectedClient.nomContact,
                                                            email: selectedClient.email,
                                                            telephone: selectedClient.telephone,
                                                            adresse: selectedClient.adresse,
                                                            codePostal: selectedClient.codePostal,
                                                            ville: selectedClient.ville,
                                                            siret: selectedClient.siret,
                                                            rcs: selectedClient.rcs
                                                        });
                                                    }}
                                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                                >
                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Modifier
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // Save changes to client
                                                            const updatedClient = { ...selectedClient, ...editedClientData };
                                                            dataService.saveClient(updatedClient);
                                                            refreshData();
                                                            setIsEditingClient(false);
                                                        }}
                                                        className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors"
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        Enregistrer
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingClient(false)}
                                                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                        Annuler
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {!isEditingClient ? (
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Client :</span>
                                                    <p className="text-foreground font-medium">{selectedClient.nom}</p>
                                                </div>
                                                {(selectedClient.prenomContact || selectedClient.nomContact) && (
                                                    <div>
                                                        <span className="text-muted-foreground">Contact :</span>
                                                        <p className="text-foreground">{selectedClient.prenomContact} {selectedClient.nomContact}</p>
                                                    </div>
                                                )}
                                                {selectedClient.email && (
                                                    <div>
                                                        <span className="text-muted-foreground">Email :</span>
                                                        <p className="text-foreground">{selectedClient.email}</p>
                                                    </div>
                                                )}
                                                {selectedClient.telephone && (
                                                    <div>
                                                        <span className="text-muted-foreground">Téléphone :</span>
                                                        <p className="text-foreground">{selectedClient.telephone}</p>
                                                    </div>
                                                )}
                                                {selectedClient.siret && (
                                                    <div>
                                                        <span className="text-muted-foreground">SIRET :</span>
                                                        <p className="text-foreground">{selectedClient.siret}</p>
                                                    </div>
                                                )}
                                                {selectedClient.rcs && (
                                                    <div>
                                                        <span className="text-muted-foreground">RCS :</span>
                                                        <p className="text-foreground">{selectedClient.rcs}</p>
                                                    </div>
                                                )}
                                                {selectedClient.adresse && (
                                                    <div className="col-span-2">
                                                        <span className="text-muted-foreground">Adresse :</span>
                                                        <p className="text-foreground">{selectedClient.adresse}</p>
                                                        {(selectedClient.codePostal || selectedClient.ville) && (
                                                            <p className="text-foreground">
                                                                {selectedClient.codePostal} {selectedClient.ville}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="col-span-2">
                                                    <label className="block text-xs text-muted-foreground mb-1">Client / Société</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.nom || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, nom: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500 font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-muted-foreground mb-1">Prénom Contact</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.prenomContact || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, prenomContact: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-muted-foreground mb-1">Nom Contact</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.nomContact || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, nomContact: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs text-muted-foreground mb-1">Email</label>
                                                    <input
                                                        type="email"
                                                        value={editedClientData.email || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, email: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs text-muted-foreground mb-1">Téléphone</label>
                                                    <input
                                                        type="tel"
                                                        value={editedClientData.telephone || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, telephone: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-muted-foreground mb-1">SIRET</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.siret || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, siret: e.target.value })}
                                                        placeholder="Ex: 123 456 789 00012"
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-muted-foreground mb-1">RCS</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.rcs || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, rcs: e.target.value })}
                                                        placeholder="Ex: RCS Paris 123 456 789"
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs text-muted-foreground mb-1">Adresse</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.adresse || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, adresse: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-muted-foreground mb-1">Code postal</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.codePostal || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, codePostal: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-muted-foreground mb-1">Ville</label>
                                                    <input
                                                        type="text"
                                                        value={editedClientData.ville || ""}
                                                        onChange={(e) => setEditedClientData({ ...editedClientData, ville: e.target.value })}
                                                        className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Lines */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Lignes de facturation</h3>
                        </div>
                        <div className="grid gap-4 px-2 py-3 text-sm font-medium text-muted-foreground pl-8"
                            style={{
                                gridTemplateColumns: [
                                    "4fr", // Description
                                    showDateColumn ? "1.6fr" : null,
                                    "0.7fr", // Qté
                                    "1.1fr", // P.U HT
                                    "1.3fr", // Total HT (moved)
                                    "0.8fr", // TVA
                                    showTTCColumn ? "1.2fr" : null, // Total TTC
                                    discountEnabled ? "1.1fr" : null, // Remise (moved to end)
                                    "0.4fr"
                                ].filter(Boolean).join(" ")
                            }}>
                            <div className="pl-1">Description</div>
                            {showDateColumn && <div className="text-center">Date</div>}
                            <div className="text-center">Qté</div>
                            <div className="text-right">P.U HT</div>
                            <div className="text-right">Total HT</div>
                            <div className="text-center">TVA</div>
                            {showTTCColumn && <div className="text-right">Total TTC</div>}
                            {discountEnabled && <div className="text-right">Remise</div>}
                            <div></div>
                        </div>

                        <div className="space-y-2">
                            <Reorder.Group axis="y" values={fields} onReorder={(newOrder) => {
                                // We need to update the form state with the new order
                                // Since useFieldArray doesn't support direct reordering with Reorder.Group values easily,
                                // we use replace() to update the entire array.
                                replace(newOrder);
                            }}>
                                {fields.map((field, index) => (
                                    <InvoiceLineItem
                                        key={field.id}
                                        field={field}
                                        index={index}
                                        showDateColumn={showDateColumn}
                                        showTTCColumn={showTTCColumn}
                                        discountEnabled={discountEnabled}
                                        discountType={discountType}
                                        products={products}
                                        remove={remove}
                                        handleDescriptionChange={handleDescriptionChange}
                                    />
                                ))}
                            </Reorder.Group>
                        </div>

                        <div className="flex gap-4 mt-4">
                            <button
                                type="button"
                                onClick={() => append({
                                    id: uuidv4(),
                                    description: "",
                                    quantite: 1,
                                    prixUnitaire: 0,
                                    tva: defaultTva,
                                    totalLigne: 0,
                                    produitId: "",
                                    type: 'produit',
                                    remise: 0,
                                    remiseType: 'pourcentage'
                                })}
                                className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition-colors"
                            >
                                <Plus className="h-4 w-4" /> Ajouter un produit
                            </button>
                            <button
                                type="button"
                                onClick={() => append({
                                    id: uuidv4(),
                                    description: "",
                                    quantite: 0,
                                    prixUnitaire: 0,
                                    tva: 0,
                                    totalLigne: 0,
                                    produitId: "",
                                    type: 'texte'
                                })}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Type className="h-4 w-4" /> Ajouter du texte
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-white/20 dark:bg-white/10" />

                    {/* Global Discount Section */}
                    <div className="glass-card rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <input
                                type="checkbox"
                                id="applyGlobalDiscount"
                                checked={(watchedRemiseGlobale || 0) > 0}
                                onChange={(e) => setValue("remiseGlobale", e.target.checked ? 5 : 0)}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                            />
                            <label htmlFor="applyGlobalDiscount" className="text-sm font-medium text-foreground cursor-pointer">
                                Appliquer une remise globale
                            </label>
                        </div>
                        {(watchedRemiseGlobale || 0) > 0 && (
                            <div className="flex items-end gap-4">
                                <div className="flex-1 space-y-1">
                                    <label className="text-sm text-muted-foreground block">
                                        {watchedRemiseGlobaleType === 'pourcentage' ? "Pourcentage (%)" : "Montant (€)"}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={watchedRemiseGlobaleType === 'pourcentage' ? "100" : undefined}
                                            {...register("remiseGlobale", { valueAsNumber: true })}
                                            className="flex-1 h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <div className="flex rounded-lg bg-white/5 border border-white/10 p-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (watchedRemiseGlobaleType !== 'pourcentage') {
                                                        setValue('remiseGlobaleType', 'pourcentage');
                                                        // Keep value as is
                                                    }
                                                }}
                                                className={cn(
                                                    "px-2 py-1 rounded text-xs font-medium transition-colors",
                                                    watchedRemiseGlobaleType === 'pourcentage'
                                                        ? "bg-blue-500 text-white"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (watchedRemiseGlobaleType !== 'montant') {
                                                        setValue('remiseGlobaleType', 'montant');
                                                        // Keep value as is
                                                    }
                                                }}
                                                className={cn(
                                                    "px-2 py-1 rounded text-xs font-medium transition-colors",
                                                    watchedRemiseGlobaleType === 'montant'
                                                        ? "bg-blue-500 text-white"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                €
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm text-muted-foreground mb-1 block">
                                        {watchedRemiseGlobaleType === 'pourcentage' ? "Montant calculé" : "Pourcentage calculé"}
                                    </label>
                                    <div className="h-10 rounded-lg bg-white/5 border border-white/10 px-3 flex items-center text-foreground font-medium">
                                        {watchedRemiseGlobaleType === 'pourcentage' ? (
                                            <>
                                                -{totals.remiseGlobale.toFixed(2)} €
                                            </>
                                        ) : (
                                            <>
                                                {totals.htAvantRemiseGlobale > 0
                                                    ? ((totals.remiseGlobale / totals.htAvantRemiseGlobale) * 100).toFixed(2)
                                                    : "0.00"} %
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-96 space-y-2">
                            {(discountEnabled || totals.remiseGlobale > 0) ? (
                                <>
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Total HT (avant remises)</span>
                                        <span>{(totals.htAvantRemiseGlobale + totals.remiseLignes).toFixed(2)} €</span>
                                    </div>
                                    {totals.remiseLignes > 0 && (
                                        <div className="flex justify-between text-sm text-orange-400">
                                            <span>Remises lignes</span>
                                            <span>-{totals.remiseLignes.toFixed(2)} €</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Sous-total HT</span>
                                        <span>{totals.htAvantRemiseGlobale.toFixed(2)} €</span>
                                    </div>
                                    {totals.remiseGlobale > 0 && (
                                        <div className="flex justify-between text-sm text-orange-400">
                                            <span>Remise globale ({watchedRemiseGlobale}%)</span>
                                            <span>-{totals.remiseGlobale.toFixed(2)} €</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm font-medium text-foreground">
                                        <span>Total HT net</span>
                                        <span>{totals.ht.toFixed(2)} €</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between text-sm font-medium text-foreground">
                                    <span>Total HT</span>
                                    <span>{totals.ht.toFixed(2)} €</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>TVA</span>
                                <span>{totals.tva.toFixed(2)} €</span>
                            </div>
                            <div className="h-px bg-white/20 dark:bg-white/10 my-2" />
                            <div className="flex justify-between text-xl font-bold text-foreground">
                                <span>Total TTC</span>
                                <span>{totals.ttc.toFixed(2)} €</span>
                            </div>
                        </div>
                    </div>
                </div>

                <PDFPreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    pdfUrl={previewUrl}
                    invoiceNumber={watch("numero")}
                />
            </form>
        </FormProvider>
    );
}
