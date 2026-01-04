"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useForm, useFieldArray, Control, useWatch, FormProvider } from "react-hook-form";
import { Plus, Trash2, Save, FileText, Send, Eye, MoreHorizontal, Download, ArrowLeft, Loader2, Calendar as CalendarIcon, Check, ChevronsUpDown, X, Search, Tag, Settings, Type, GripVertical, Lock, Unlock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Facture, Devis, Client, LigneItem, Produit, Societe, StatusFacture, StatusDevis } from "@/types";
import { Reorder } from "framer-motion";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { generateNextInvoiceNumber, generateNextQuoteNumber } from "@/lib/invoice-utils";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";
import { InvoiceLineItem } from "./InvoiceLineItem";
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { createInvoice, updateInvoice, createQuote, updateQuote, toggleQuoteLock, toggleInvoiceLock, markInvoiceAsDownloaded } from "@/app/actions";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { SidePanel } from "@/components/ui/SidePanel";
import { CommunicationsPanel } from "@/components/features/CommunicationsPanel";
import { EmailComposer } from "@/components/features/EmailComposer";
import { useInvoiceEmail } from "@/hooks/use-invoice-email";
import { Minimize2, Maximize2, Clock } from "lucide-react";
import Link from "next/link";
import { ClientEditor } from "./ClientEditor";
import { getClientDisplayName, getClientSearchText } from "@/lib/client-utils";
import { saveDraft, getDraft } from "@/lib/draft-storage";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDocumentPage } from "../mobile/features/MobileDocumentPage";



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


export function InvoiceEditor(props: { type?: "Facture" | "Devis", initialData?: Facture | Devis }) {
    const isMobile = useIsMobile();
    const documentId = props.initialData?.id || 'new';

    console.log("[InvoiceEditor] Rendering with isMobile:", isMobile, "documentId:", documentId);

    if (isMobile) {
        return <MobileDocumentPage
            key={`mobile-${documentId}`}
            type={props.type === "Facture" ? "FACTURE" : "DEVIS"}
            id={props.initialData?.id}
            initialMode="edit"

        />;
    }

    return <DesktopInvoiceEditor key={`desktop-${documentId}`} {...props} />;
}

function DesktopInvoiceEditor({ type = "Facture", initialData }: { type?: "Facture" | "Devis", initialData?: Facture | Devis }) {
    const { clients: globalClients, products, refreshData, societe, invoices, quotes, logAction, addInvoice, updateInvoiceInList } = useData();
    const [optimisticClients, setOptimisticClients] = useState<Client[]>([]);

    const clients = [
        ...optimisticClients,
        ...globalClients.filter(c => !optimisticClients.some(oc => oc.id === c.id))
    ];
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Local state for immediate UI feedback (Status)
    const [localStatus, setLocalStatus] = useState(initialData?.statut || (type === "Facture" ? "Brouillon" : "Brouillon"));

    // Hydrate optimistic clients with initial client data to prevent "disappearing" on hard refresh
    useEffect(() => {
        if (initialData && (initialData as any).client) {
            const client = (initialData as any).client;
            if (client && client.id && client.nom) {
                setOptimisticClients(prev => {
                    if (prev.some(c => c.id === client.id)) return prev;
                    return [...prev, client as Client];
                });
            }
        }
    }, [initialData]);

    // Generate next invoice/quote number
    const getNextNumber = () => {
        if (initialData?.numero) return initialData.numero; // Keep existing number when editing
        return type === "Facture"
            ? generateNextInvoiceNumber(invoices)
            : generateNextQuoteNumber(quotes);
    };

    // Robust defaults builder
    const buildFormDefaults = (data?: Facture | Devis): InvoiceFormValues => {
        if (!data) {
            // Default fresh state
            const date = new Date();
            date.setDate(date.getDate() + 30);
            return {
                numero: getNextNumber(),
                clientId: "",
                dateEmission: new Date().toISOString().split("T")[0],
                echeance: date.toISOString().split("T")[0],
                conditionsPaiement: "30 jours",
                items: [{
                    id: uuidv4(), // Generate ID once here
                    description: "",
                    quantite: 1,
                    prixUnitaire: 0,
                    tva: 20,
                    totalLigne: 0,
                    produitId: "",
                    type: 'produit',
                    remise: 0,
                    remiseType: 'pourcentage'
                }]
            };
        }

        // Helper to format date safely
        const formatDate = (dateVal: string | Date | undefined) => {
            if (!dateVal) return "";
            try {
                return typeof dateVal === 'string' ? dateVal.split('T')[0] : new Date(dateVal).toISOString().split('T')[0];
            } catch (e) {
                return "";
            }
        };

        const emissionDate = formatDate(data.dateEmission) || new Date().toISOString().split("T")[0];

        // Handle Echeance / Date Validite
        let echeanceDate = "";
        if ('echeance' in data && data.echeance) {
            echeanceDate = formatDate(data.echeance);
        } else if ('dateValidite' in data && (data as any).dateValidite) {
            echeanceDate = formatDate((data as any).dateValidite);
        }

        if (!echeanceDate) {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            echeanceDate = d.toISOString().split("T")[0];
        }

        // Calculate conditions conditionsPaiement if missing
        let conditions = (data as any).conditionsPaiement || "30 jours";
        if (!(data as any).conditionsPaiement && emissionDate && echeanceDate) {
            // Logic repeated from before
            const start = new Date(emissionDate);
            const end = new Date(echeanceDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                if (diff <= 0) conditions = "À réception";
                else if (diff === 15) conditions = "15 jours";
                else if (diff === 30) conditions = "30 jours";
                else if (diff === 45) conditions = "45 jours";
                else if (diff === 60) conditions = "60 jours";
                else conditions = "Personnalisé";
            }
        }

        return {
            numero: data.numero,
            clientId: data.clientId,
            dateEmission: emissionDate,
            echeance: echeanceDate,
            conditionsPaiement: conditions,
            numeroEnregistrement: (data as any).numeroEnregistrement,
            codeService: (data as any).codeService,
            remiseGlobale: data.remiseGlobale,
            remiseGlobaleType: data.remiseGlobaleType,
            items: (Array.isArray(data.items) ? data.items : []).map(item => ({
                ...item,
                id: item.id || uuidv4(), // Ensure IDs exist
                // Ensure strict number types to match form expectations and avoid string/number mismatch dirty states
                quantite: typeof item.quantite === 'string' ? parseFloat(item.quantite) : (item.quantite || 1),
                prixUnitaire: typeof item.prixUnitaire === 'string' ? parseFloat(item.prixUnitaire) : (item.prixUnitaire || 0),
                remise: typeof item.remise === 'string' ? parseFloat(item.remise) : (item.remise || 0),
                tva: typeof item.tva === 'string' ? parseFloat(item.tva) : (item.tva || 20),
                description: item.description || ""
            }))
        };
    };

    const methods = useForm<InvoiceFormValues>({
        defaultValues: buildFormDefaults(initialData)
    });

    const { register, control, handleSubmit, setValue, watch, getValues, setError, clearErrors, reset, formState: { errors, isDirty, dirtyFields } } = methods;

    const nextActionRef = useRef<'redirect' | 'send' | null>('redirect');
    const isInitialized = useRef(false);

    // -- STATE DECLARATIONS --
    const [isClientOpen, setIsClientOpen] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [isLocked, setIsLocked] = useState<boolean>(initialData?.isLocked ?? false);
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [editedClientData, setEditedClientData] = useState<Partial<Client>>({});
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Config States
    const globalConfig = dataService.getGlobalConfig();
    const defaults = type === "Facture" ? globalConfig.invoiceDefaults : globalConfig.quoteDefaults;

    const [showDateColumn, setShowDateColumn] = useState(initialData?.config?.showDateColumn ?? defaults?.showDate ?? globalConfig.showDateColumn ?? false);
    const [showQuantiteColumn, setShowQuantiteColumn] = useState(initialData?.config?.showQuantiteColumn ?? defaults?.showQuantite ?? true);
    const [showTvaColumn, setShowTvaColumn] = useState(initialData?.config?.showTvaColumn ?? defaults?.showTva ?? true);
    const [showRemiseColumn, setShowRemiseColumn] = useState(initialData?.config?.showRemiseColumn ?? defaults?.showRemise ?? false);
    const [showTTCColumn, setShowTTCColumn] = useState(initialData?.config?.showTTCColumn ?? defaults?.showTtc ?? globalConfig.showTTCColumn ?? false);
    const [discountEnabled, setDiscountEnabled] = useState(initialData?.config?.discountEnabled ?? defaults?.showRemise ?? globalConfig.discountEnabled ?? false);
    const [discountType, setDiscountType] = useState<'pourcentage' | 'montant'>(initialData?.config?.discountType || globalConfig.discountType || 'pourcentage');
    const [defaultTva, setDefaultTva] = useState(initialData?.config?.defaultTva ?? globalConfig.defaultTva ?? 20);
    const [showOptionalFields, setShowOptionalFields] = useState(initialData?.config?.showOptionalFields ?? globalConfig.showOptionalFields ?? false);

    // -- DRAFT REF --
    const draftRef = useRef<any>(null);

    // Watch values for auto-save (stable object)
    const formValues = watch();

    // Unified persistence object
    const persistenceData = {
        ...formValues,
        // ABSOLUTE SERVER PRIORITY: If server is locked or has a hard-locked status, 
        // the draft MUST also be locked. We never save a 'deverrouillé' draft for a 'verrouillé' server doc.
        isLocked: isLocked || !!initialData?.isLocked,
        statut: (type === 'Facture' && ["Envoyée", "Payée", "Annulée", "Archivée"].includes(initialData?.statut as any))
            ? initialData?.statut
            : (type === 'Devis' && ["Facturé", "Archivé"].includes(initialData?.statut as any))
                ? initialData?.statut
                : localStatus,
        defaultTva,
        showDateColumn,
        showQuantiteColumn,
        showTvaColumn,
        showRemiseColumn,
        showTTCColumn,
        discountEnabled,
        discountType,
        showOptionalFields,
        updatedAt: Date.now()
    };

    useLayoutEffect(() => {
        draftRef.current = persistenceData;
    });

    // Save on Unmount
    useLayoutEffect(() => {
        return () => {
            if (!isInitialized.current) return;
            console.log("[DESKTOP] Unmounting - forcing draft save", draftRef.current);
            saveDraft(initialData?.id || 'new', draftRef.current);
        };
    }, [initialData?.id]);


    // Auto-Save
    useEffect(() => {
        if (!isInitialized.current) return;
        const timer = setTimeout(() => {
            saveDraft(initialData?.id || 'new', persistenceData);
        }, 1500);
        return () => clearTimeout(timer);
    }, [
        initialData?.id,
        formValues.clientId,
        formValues.dateEmission,
        formValues.echeance,
        formValues.items,
        isLocked,
        localStatus,
        defaultTva,
        showDateColumn,
        showQuantiteColumn,
        showTvaColumn,
        showRemiseColumn,
        showTTCColumn,
        discountEnabled,
        discountType,
        showOptionalFields
    ]);

    // Reset form when initialData loads or ID changes (Robust Reset) WITH Draft Logic
    useEffect(() => {
        if (!initialData?.id) return;

        // 0. RESET STALE STATE ON ID CHANGE
        // This is CRITICAL to prevent 'spontaneous unlocking' when navigating from a locked to unlocked doc.
        isInitialized.current = false;
        setIsLocked(!!initialData.isLocked);
        setLocalStatus(initialData.statut as any);

        console.log("!!! [DESKTOP] INITIALIZATION (Consolidated) !!!", { id: initialData.id, serverLocked: !!initialData.isLocked });

        // 1. Start with Server Defaults
        let finalValues = buildFormDefaults(initialData);

        // 2. Check for Draft Override
        const draft = getDraft(initialData.id);

        if (draft) {
            console.log("[DESKTOP] Checking Draft during Init:", {
                serverTime: initialData.updatedAt,
                draftTime: draft.updatedAt
            });

            let useDraft = false;
            if (initialData.updatedAt) {
                const serverTime = new Date(initialData.updatedAt).getTime();
                // Server win if NEWER than draft
                if (serverTime > draft.updatedAt) {
                    console.warn("[DESKTOP] Server is newer. Ignoring draft.");
                } else {
                    useDraft = true;
                }
            } else {
                useDraft = true;
            }

            if (useDraft) {
                console.log("!!! [DESKTOP] OVERRIDING SERVER DEFAULTS WITH DRAFT !!!", {
                    itemsCount: draft.items?.length,
                    tva_Global: draft.defaultTva,
                    FIRST_ITEM: draft.items?.[0]
                });
                finalValues = {
                    ...finalValues,
                    clientId: draft.clientId || finalValues.clientId,
                    dateEmission: draft.dateEmission || finalValues.dateEmission,
                    echeance: draft.echeance || finalValues.echeance,
                    conditionsPaiement: draft.conditionsPaiement || finalValues.conditionsPaiement,
                    remiseGlobale: draft.remiseGlobale,
                    remiseGlobaleType: draft.remiseGlobaleType,
                    items: (draft.items || finalValues.items).map((item: any) => ({
                        ...item,
                        id: item.id || uuidv4(),
                        quantite: typeof item.quantite === 'string' ? parseFloat(item.quantite.replace(',', '.')) : (Number(item.quantite) || 0),
                        prixUnitaire: typeof item.prixUnitaire === 'string' ? parseFloat(item.prixUnitaire.replace(',', '.')) : (Number(item.prixUnitaire) || 0),
                        remise: typeof item.remise === 'string' ? parseFloat(item.remise.replace(',', '.')) : (Number(item.remise) || 0),
                        tva: typeof item.tva === 'string' ? parseFloat(item.tva.replace(',', '.')) : (Number(item.tva) || 20),
                    }))
                };

                // Restore Config States
                if (draft.defaultTva !== undefined) setDefaultTva(draft.defaultTva);
                if (draft.showDateColumn !== undefined) setShowDateColumn(draft.showDateColumn);
                if (draft.showQuantiteColumn !== undefined) setShowQuantiteColumn(draft.showQuantiteColumn);
                if (draft.showTvaColumn !== undefined) setShowTvaColumn(draft.showTvaColumn);
                if (draft.showRemiseColumn !== undefined) setShowRemiseColumn(draft.showRemiseColumn);
                if (draft.showTTCColumn !== undefined) setShowTTCColumn(draft.showTTCColumn);
                if (draft.discountEnabled !== undefined) setDiscountEnabled(draft.discountEnabled);
                if (draft.discountType) setDiscountType(draft.discountType);
                if (draft.showOptionalFields !== undefined) setShowOptionalFields(draft.showOptionalFields);
                // Strict Lock Priority: Server wins if it's already locked
                const serverLocked = !!initialData.isLocked;
                const draftLocked = draft.isLocked !== undefined ? draft.isLocked : serverLocked;
                const finalLocked = serverLocked || draftLocked;
                setIsLocked(finalLocked);

                // Strict Status Priority: Server wins if it's in a hard-locked state
                const serverStatus = initialData.statut;
                const isServerHardLocked = type === "Facture"
                    ? ["Envoyée", "Payée", "Annulée", "Archivée"].includes(serverStatus as StatusFacture)
                    : ["Facturé", "Archivé"].includes(serverStatus as StatusDevis);

                const finalStatus = isServerHardLocked ? serverStatus : (draft.statut || serverStatus);
                setLocalStatus(finalStatus as any);
            }
        }

        // Force Sync draftRef with final calculated values to prevent stale unmount save
        draftRef.current = {
            ...persistenceData,
            clientId: finalValues.clientId,
            dateEmission: finalValues.dateEmission,
            echeance: finalValues.echeance,
            conditionsPaiement: finalValues.conditionsPaiement,
            remiseGlobale: finalValues.remiseGlobale,
            remiseGlobaleType: finalValues.remiseGlobaleType,
            items: finalValues.items,
        };

        reset(finalValues, { keepDirty: false, keepTouched: false });
        isInitialized.current = true;
        console.log("[DESKTOP] Initialization Complete. Draft Safety Locked & Ref Synced.");

    }, [initialData?.id, reset]); // Dependency on ID is key


    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: "items",
        rules: {
            required: "Ajoutez au moins un produit.",
            validate: (value) => (value && value.length > 0) || "Ajoutez au moins un produit."
        }
    });

    // --- LOCK & READONLY LOGIC ---
    const isHardLocked = type === "Facture"
        ? ["Envoyée", "Payée", "Annulée", "Archivée"].includes(localStatus as StatusFacture)
        : ["Facturé", "Archivé"].includes(localStatus as StatusDevis);

    const isReadOnly = isHardLocked || isLocked;
    const [isLocking, setIsLocking] = useState(false);

    // Remove old debug states/effects if any remained (cleaned)





    const handleToggleLock = async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling issues
        }

        if (isHardLocked) return;
        if (isLocking) return;

        // Calculate Next State
        const nextLocked = !isLocked;

        // --- UNLOCK FLOW (Optimistic) ---
        if (!nextLocked) {
            setIsLocked(false);
            setIsLocking(true);

            try {
                // Server Call
                const res = type === "Facture"
                    ? await toggleInvoiceLock(initialData!.id, false)
                    : await toggleQuoteLock(initialData!.id, false);

                if (!res.success) throw new Error(res.error || "Erreur serveur");

                toast.success(`${type} déverrouillé`);

                // Update local data wrapper to ensure dashboard is in sync
                refreshData();
            } catch (err: any) {
                // Rollback
                setIsLocked(true);
                toast.error(err.message || "Erreur lors du déverrouillage");
                console.error(err);
            } finally {
                setIsLocking(false);
            }
            return;
        }

        // --- LOCK FLOW (Save + Lock) ---
        // 1. Validate Form First
        await handleSubmit(async (data) => {

            // Custom validations (keep existing logic)
            let hasInvalidItems = false;
            data.items.forEach((item) => {
                const q = Number(item.quantite);
                const p = Number(item.prixUnitaire);
                if (isNaN(q) || q <= 0) hasInvalidItems = true;
                if (isNaN(p) || p < 0) hasInvalidItems = true;
            });

            if (hasInvalidItems) {
                toast.error("Veuillez corriger les lignes (quantité/prix) avant de verrouiller.");
                return; // Stop here, no optimistic update
            }

            if (isNaN(new Date(data.dateEmission).getTime())) {
                toast.error("Date d'émission invalide.");
                return;
            }

            // 2. Optimistic Update
            setIsLocked(true);
            setIsLocking(true);

            try {


                // --- 3. Save Document ---
                let result;
                const documentData = {
                    id: initialData!.id,
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
                    societeId: societe?.id || "",
                    items: data.items.map(item => ({
                        ...item,
                        id: item.id || uuidv4(),
                    })),
                    ...(type === "Facture" ? {
                        statut: initialData?.statut || "Brouillon",
                        echeance: data.echeance
                    } : {
                        statut: initialData?.statut || "Brouillon",
                        dateValidite: (data as any).dateValidite || ""
                    }),
                };

                // 3. Save
                console.log("[DEBUG] Calling Server Action...", { type, id: documentData.id });
                const saveRes = type === "Facture"
                    // @ts-ignore
                    ? await updateInvoice(documentData)
                    // @ts-ignore
                    : await updateQuote(documentData);

                if (!saveRes.success) throw new Error(saveRes.error || "Erreur sauvegarde");

                // 4. Lock Server
                const lockRes = type === "Facture"
                    ? await toggleInvoiceLock(initialData!.id, true)
                    : await toggleQuoteLock(initialData!.id, true);

                if (!lockRes.success) throw new Error(lockRes.error || "Erreur verrouillage");

                toast.success(`${type} enregistré et verrouillé`);

                // Update form "pristine" state but keep values
                reset(getValues(), { keepValues: true, keepDirty: false });

                refreshData();

            } catch (err: any) {
                // Rollback
                setIsLocked(false);
                toast.error(err.message || "Erreur technique");
            } finally {
                setIsLocking(false);
            }

        }, (errors) => {
            console.error("[DEBUG] Validation Errors:", JSON.stringify(errors, null, 2));
            const missingFields = Object.keys(errors).join(", ");
            toast.error(`Formulaire invalide : ${missingFields || "champs manquants"}`);
        })();
    };


    const [globalDiscountType, setGlobalDiscountType] = useState<'pourcentage' | 'montant'>(initialData?.remiseGlobaleType || 'pourcentage');

    // Freeze Operation Type
    // If Editing (initialData exists): Use saved value. If missing (legacy), force 'service' to preserve history.
    // If Creating (no initialData): Use current Global Config.
    const [operationType] = useState<'none' | 'service' | 'goods'>(() => {
        if (initialData) {
            return initialData.config?.operationType ?? 'service';
        }
        return globalConfig.operationType ?? 'service';
    });

    const [isClientModalOpen, setIsClientModalOpen] = useState(false); // Modal state
    const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false); // Confirmation modal
    const [isSaving, setIsSaving] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    const clientDropdownRef = useRef<HTMLDivElement>(null);

    // Email & History State
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const { sendEmail, isUndoVisible, cancelSend } = useInvoiceEmail();
    const [draftData, setDraftData] = useState<any>(null);

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
            const formattedDueDate = dueDate.toISOString().split("T")[0];

            // Only update if different to avoid triggering isDirty on load
            if (getValues("echeance") !== formattedDueDate) {
                setValue("echeance", formattedDueDate, { shouldDirty: false });
            }
        }
    }, [watchDateEmission, watchConditionsPaiement, setValue, getValues]);

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


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
                setIsClientOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsSettingsOpen(false);
                setIsClientOpen(false);
            }
        };

        if (isSettingsOpen || isClientOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isSettingsOpen, isClientOpen]);

    // Clear line discounts when disabled
    useEffect(() => {
        if (!discountEnabled) {
            // Only update if there are items with non-zero discount to avoid initial dirtying
            const hasDiscounts = watchedItems.some(item => item.remise && item.remise > 0);
            if (hasDiscounts) {
                setValue("items", watchedItems.map(item => ({ ...item, remise: 0 })), { shouldDirty: true });
            }
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
            setValue(`items.${index}.description`, product.nom, { shouldDirty: true });
            setValue(`items.${index}.prixUnitaire`, product.prixUnitaire, { shouldDirty: true });
            setValue(`items.${index}.tva`, product.tva, { shouldDirty: true });
        }
    };

    const handleDescriptionChange = (index: number, value: string) => {
        setValue(`items.${index}.description`, value);

        // Check if the entered text matches a product name
        const matchingProduct = products.find(p => p.nom.toLowerCase() === value.toLowerCase());
        if (matchingProduct) {
            setValue(`items.${index}.prixUnitaire`, matchingProduct.prixUnitaire, { shouldDirty: true });
            setValue(`items.${index}.tva`, matchingProduct.tva, { shouldDirty: true });
            setValue(`items.${index}.produitId`, matchingProduct.id, { shouldDirty: true });
        } else {
            // Important: if user types a name that doesn't match, clear the ID 
            // so the backend knows to treat it as a potential new product to auto-create.
            setValue(`items.${index}.produitId`, undefined, { shouldDirty: true });
        }
    };

    const onSubmit = async (data: InvoiceFormValues) => {
        setIsSaving(true);
        try {
            // --- 1. Client-Side Validation ---

            // Client Check
            // RHF handles required, but safe to keep as sanity check before server call
            if (!data.clientId) {
                // Should not happen if required:true worked
                toast.error("Veuillez sélectionner un client.");
                setIsSaving(false);
                return;
            }

            // Items Check - (Relying on RHF validation, but keeping check for payload safety)
            if (!data.items || data.items.length === 0) {
                // Manual fallback if RHF didn't catch it for some reason (rare but possible with dynamic fields)
                setError("items", { type: "manual", message: "Ajoutez au moins un produit." });
                toast.error("Veuillez ajouter au moins une ligne.");
                setIsSaving(false);
                return;
            }

            // Detailed Item Validation
            let hasInvalidItems = false;

            console.log("[DEBUG_CLIENT] onSubmit triggered. Data:", JSON.stringify(data, null, 2));
            console.log("[DEBUG_CLIENT] Client ID:", data.clientId);
            console.log("[DEBUG_CLIENT] Items count:", data.items?.length);

            data.items.forEach((item, index) => {
                // Ensure numbers
                const q = Number(item.quantite);
                const p = Number(item.prixUnitaire);

                if (isNaN(q) || q <= 0) {
                    toast.error(`Ligne ${index + 1}: Quantité invalide.`);
                    hasInvalidItems = true;
                }
                if (showDateColumn && !item.date) {
                    // Optimized: Use setError instead of toast
                    setError(`items.${index}.date`, {
                        type: "manual",
                        message: "Date requise"
                    });
                    hasInvalidItems = true;
                }

                if (isNaN(p) || p < 0) {
                    toast.error(`Ligne ${index + 1}: Prix invalide.`);
                    hasInvalidItems = true;
                }

                // Check for empty description
                // Check for empty description
                if (!item.description || item.description.trim() === "") {
                    // Removed generic toast to use targeted field error
                    setError(`items.${index}.description`, {
                        type: "manual",
                        message: "Produit manquant"
                    });
                    hasInvalidItems = true;
                }
            });

            if (hasInvalidItems) {
                setIsSaving(false);
                return;
            }

            // Date Column Validation
            if (showDateColumn) {
                const missingDate = data.items.some(item => !item.date);
                if (missingDate) {
                    toast.error("La colonne Date est activée mais certaines lignes n’ont pas de date. Ajoutez une date à chaque ligne ou désactivez la colonne Date.");
                    setIsSaving(false);
                    return;
                }
            }

            // Date validation
            const emissionDate = new Date(data.dateEmission);
            if (isNaN(emissionDate.getTime())) {
                toast.error("Date d'émission invalide.");
                setIsSaving(false);
                return;
            }


            // --- Optimization: Check if clean state && Send Action ---
            if (initialData?.id && !isDirty && nextActionRef.current === 'send') {
                // Skip saving & logging, proceed directly to sending
                setIsComposerOpen(true);
                nextActionRef.current = null;
                setIsSaving(false); // Reset saving state
                return;
            }

            // --- 2. Data Construction ---
            const documentData = {
                id: initialData?.id, // Keep existing ID if update, otherwise undefined (Prisma generates on create)
                ...data, // Contains basic form fields
                totalHT: totals.ht,
                totalTVA: totals.tva,
                totalTTC: totals.ttc,
                config: JSON.stringify({
                    showDateColumn,
                    showTTCColumn,
                    discountEnabled,
                    discountType,
                    defaultTva,
                    showOptionalFields,
                    showQuantiteColumn,
                    showTvaColumn,
                    showRemiseColumn,
                    operationType // Save frozen operation type
                }),
                remiseGlobale: data.remiseGlobale || 0,
                remiseGlobaleMontant: totals.remiseGlobale,
                clientId: data.clientId,
                societeId: societe?.id || "",
                items: data.items.map(item => ({
                    ...item,
                    id: item.id || uuidv4(), // Ensure items have IDs
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
                    dateValidite: (data as any).dateValidite || "",
                    isLocked: isLocked
                })
            } as unknown as Facture | Devis;

            // --- 3. Server Submission ---
            console.log("[DEBUG_CLIENT] Calling Server Action. Type:", type, "ID:", initialData?.id);
            let result;
            if (type === "Facture") {
                if (initialData?.id) {
                    console.log("[DEBUG_CLIENT] Invoking updateInvoice...");
                    result = await updateInvoice(documentData as Facture);
                    console.log("[DEBUG_CLIENT] updateInvoice returned:", result);
                } else {
                    console.log("[DEBUG_CLIENT] Invoking createInvoice...");
                    result = await createInvoice(documentData as Facture);
                    console.log("[DEBUG_CLIENT] createInvoice returned:", result);
                }
            } else {
                if (initialData?.id) {
                    result = await updateQuote(documentData as Devis);
                } else {
                    result = await createQuote(documentData as Devis);
                }
            }

            // --- 4. Result Handling ---
            if (!result.success) {
                // Display sanitized error from server action
                toast.error(result.error || "Une erreur est survenue.");
                // We keep isSaving=true for a moment or specific logic, here just stop
                setIsSaving(false);
                return;
            }

            // Log Action for Recent Activity
            const savedId = (result as any).id || (documentData as any).id;
            const actionType = initialData?.id ? 'update' : 'create';
            const entityType = type === 'Facture' ? 'facture' : 'devis';
            const clientName = clients.find(c => c.id === data.clientId);
            const description = `${actionType === 'create' ? 'Création' : 'Modification'} ${type === 'Facture' ? 'de la facture' : 'du devis'} ${documentData.numero} pour ${getClientDisplayName(clientName)} `;

            await logAction(actionType, entityType, description, savedId);

            // OPTIMIZATION: Use optimistic update instead of full refresh
            const finalDocument = { ...documentData, id: savedId };

            if (type === 'Facture') {
                if (actionType === 'create') {
                    addInvoice(finalDocument as Facture);
                } else {
                    updateInvoiceInList(finalDocument as Facture);
                }
            }
            // For quotes, we still need refreshData as we don't have addQuote/updateQuote helpers yet
            if (type === 'Devis') {
                await refreshData();
            }

            // Simulate a brief delay to show the loading state
            await new Promise(resolve => setTimeout(resolve, 300));
            toast.success(`${type} enregistré${type === "Facture" ? "e" : ""} avec succès!`);

            // RESET FORM STATE TO PRISTINE WITH NEW ID
            // This fixes the "unsaved changes" warning when navigating back
            const newFormValues = {
                ...data,
                numero: documentData.numero, // Ensure number is synced if generated
            };

            // Critical: reset with the NEW ID so RHF knows we are now editing an existing doc
            const newDefaults = buildFormDefaults({ ...finalDocument, ...newFormValues });
            reset(newDefaults, { keepValues: true, keepDirty: false, keepTouched: false }); // Force clean state



            if (nextActionRef.current === 'send') {
                if (initialData?.id === savedId) {
                    setIsComposerOpen(true);
                    nextActionRef.current = null;
                } else {
                    router.replace(type === "Facture" ? `/factures/${savedId}?action=send` : `/devis/${savedId}?action=send`);
                }
            } else {
                // Only redirect to list if creating new document from scratch
                // If editing existing document (has initialData.id), stay on same page
                if (!initialData?.id) {
                    router.push(type === "Facture" ? "/factures" : "/devis");
                }
                // If initialData.id exists, we're editing - don't redirect, just refresh
                // The form will show updated data via refreshData() call above
            }
        } catch (error: any) {
            console.error("[DEBUG_CLIENT] Critical Error saving:", error);
            // This catches unexpected client-side crashes not handled by result.success
            toast.error("Erreur critique: " + error.message);
        } finally {
            // console.log("[DEBUG_CLIENT] Finally block - setIsSaving(false)");
            setIsSaving(false);
        }
    };



    const handleGeneratePDF = async () => {
        // Guard: Block download if invoice is not saved
        if (!initialData?.id) {
            const message = type === "Facture"
                ? "La facture doit être enregistrée avant de pouvoir être téléchargée."
                : "Le devis doit être enregistré avant de pouvoir être téléchargé.";
            toast.error(message, {
                duration: 5000,
                style: {
                    background: '#EF4444',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 500
                }
            });
            return;
        }

        const formData = watch();

        // Date Column Validation for PDF
        if (showDateColumn) {
            const items = formData.items || [];
            const missingDate = items.some((item: any) => !item.date);
            if (missingDate) {
                toast.error("La colonne Date est activée mais certaines lignes n’ont pas de date. Ajoutez une date à chaque ligne ou désactivez la colonne Date.");
                return;
            }
        }

        const client = clients.find(c => c.id === formData.clientId);

        if (!client || !societe) {
            alert("Veuillez sélectionner un client.");
            return;
        }

        // Construct a temporary document object for generation
        const documentData = {
            id: initialData?.id || "temp",
            ...formData,
            // FIX: Use initialData.items as fallback if formData.items is empty
            items: (formData.items && formData.items.length > 0) ? formData.items : (initialData?.items || []),
            // Calculate totals freshly to be sure
            totalHT: totals.ht,
            totalTVA: totals.tva,
            totalTTC: totals.ttc,
            // Ensure type specific fields exist
            ...(type === "Facture" ? { statut: localStatus || initialData?.statut || "Brouillon", echeance: (formData as any).echeance || "" } : { statut: localStatus || initialData?.statut || "Brouillon", dateValidite: (formData as any).dateValidite || "" })
        } as unknown as Facture | Devis;

        // Auto-update status to "Envoyé" if it's a saved Draft and we are downloading
        if (initialData?.id) {
            try {
                if (type === "Facture") {
                    // Only update to "Téléchargée" if current is "Brouillon" (don't overwrite "Envoyée" or "Payée")
                    // Use localStatus to avoid stale data
                    const currentStatus = localStatus || initialData.statut;
                    if (currentStatus === "Brouillon") {
                        await updateInvoice({ ...documentData as Facture, statut: 'Téléchargée' });
                        await markInvoiceAsDownloaded(initialData.id);
                        // Update local status to reflect change
                        setLocalStatus('Téléchargée');
                    }
                } else {
                    // Devis Logic: Brouillon -> Téléchargé. If already Envoyé, do nothing.
                    const currentStatus = localStatus || initialData.statut;
                    if (currentStatus === "Brouillon") {
                        await updateQuote({ ...documentData as Devis, statut: 'Téléchargé' });
                        setLocalStatus('Téléchargé' as any);
                        // We might need a helper markQuoteAsDownloaded if we want to track it, but logically just status update is key here.
                        // Using generic logAction below.
                    }
                }
                logAction('update', type === 'Facture' ? 'facture' : 'devis', `${type} téléchargé`, initialData.id);
                refreshData();
            } catch (error) {
                console.error("Error updating status on download:", error);
            }
        }

        generateInvoicePDF(documentData, societe, client, {});
    };




    const handlePreview = () => {
        // Guard: Block preview if invoice is not saved (same as download)
        if (!initialData?.id) {
            const message = type === "Facture"
                ? "La facture doit être enregistrée avant de pouvoir générer un aperçu."
                : "Le devis doit être enregistré avant de pouvoir générer un aperçu.";
            toast.error(message, {
                duration: 5000,
                style: {
                    background: '#EF4444',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 500
                }
            });
            return;
        }

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
            // FIX: Use initialData.items as fallback if formData.items is empty
            items: (formData.items && formData.items.length > 0) ? formData.items : (initialData?.items || []),
            totalHT: totals.ht,
            totalTVA: totals.tva,
            totalTTC: totals.ttc,
            config: {
                showDateColumn,
                showTTCColumn,
                discountEnabled
            },
            ...(type === "Facture" ? { statut: localStatus || initialData?.statut || "Brouillon", echeance: (formData as any).echeance || "" } : { statut: localStatus || initialData?.statut || "Brouillon", dateValidite: (formData as any).dateValidite || "" })
        } as unknown as Facture | Devis;

        const url = generateInvoicePDF(documentData, societe, client, {
            returnBlob: true
        });
        if (url && typeof url === 'string') {
            setPreviewUrl(url);
            setIsPreviewOpen(true);
        }
    };

    const filteredClients = clients.filter(client =>
        getClientSearchText(client).includes(clientSearch.toLowerCase())
    );
    const selectedClientId = watch("clientId");
    const selectedClient = clients.find(c => c.id === selectedClientId);

    const isEditMode = !!initialData?.id;
    const pageTitle = type === "Facture"
        ? (isEditMode ? "Modifier la Facture" : "Nouvelle Facture")
        : (isEditMode ? "Modifier le Devis" : "Nouveau Devis");



    // Unsaved Changes Modal State
    // Cleaned up duplicates

    // Warn on unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handleBack = () => {
        if (isDirty) {
            setIsUnsavedModalOpen(true);
        } else {
            router.back();
        }
    };

    const onInvalid = (errors: any) => {
        console.error("Form Validation Errors:", errors);
        const fieldLabels: Record<string, string> = {
            clientId: "Client",
            items: "Lignes",
            dateEmission: type === "Facture" ? "Date d'émission" : "Date de création",
            echeance: type === "Facture" ? "Échéance" : "Date de validité",
            numero: "Numéro"
        };
        const missingFields = Object.keys(errors)
            .map(key => fieldLabels[key] || key)
            .filter((value, index, self) => self.indexOf(value) === index);

        if (missingFields.length > 0) {
            toast.error(`Champs obligatoires manquants : ${missingFields.join(", ")}`);
        }
    };


    const handleStatusChange = async (newStatus: string) => {
        if (!initialData?.id) return;

        try {
            if (type === "Facture") {
                let datePaiement: Date | undefined;
                if (newStatus === "Payée") {
                    const defaultDate = new Date().toISOString().split('T')[0];
                    const inputDate = window.prompt("Date de paiement (AAAA-MM-JJ) :", defaultDate);
                    if (!inputDate) return; // Cancelled by user
                    datePaiement = new Date(inputDate);
                    if (isNaN(datePaiement.getTime())) {
                        toast.error("Date invalide");
                        return;
                    }
                }

                await updateInvoice({
                    ...initialData as Facture,
                    statut: newStatus as StatusFacture,
                    datePaiement: datePaiement ? datePaiement.toISOString() : undefined
                });
            } else {
                await updateQuote({ ...initialData as Devis, statut: newStatus as StatusDevis });
            }
            setLocalStatus(newStatus as any);
            toast.success(`Statut modifié : ${newStatus}`);
            refreshData();
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Erreur lors de la mise à jour du statut");
        }
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="p-2 text-muted-foreground hover:text-foreground glass rounded-lg transition-colors"
                            title="Retour"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-bold tracking-tight text-foreground">{pageTitle}</h2>
                                {initialData && (
                                    <StatusBadge
                                        status={localStatus}
                                        type={type}
                                        onChange={handleStatusChange}
                                        readOnly={isReadOnly && !["Envoyée", "Envoyé"].includes(localStatus)}
                                    />
                                )}


                            </div>
                            <p className="text-gray-400 mt-1 text-sm">
                                {initialData?.numero ? `Réf: ${initialData.numero}` : "Nouveau document"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative" ref={settingsRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (isReadOnly) {
                                        toast.error("Devis verrouillé : déverrouillez pour modifier la configuration.");
                                        return;
                                    }
                                    setIsSettingsOpen(!isSettingsOpen);
                                }}
                                disabled={isReadOnly}
                                className={cn(
                                    "p-2 rounded-lg transition-colors border",
                                    isReadOnly
                                        ? "text-muted-foreground opacity-50 cursor-not-allowed border-transparent"
                                        : "bg-muted/50 dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground hover:bg-muted dark:hover:bg-white/10 hover:text-foreground cursor-pointer"
                                )}
                            >
                                <Settings className="h-5 w-5" />
                            </button>



                            {isSettingsOpen && (
                                <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-border dark:border-white/10 bg-background dark:bg-slate-900/95 backdrop-blur-xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-200">
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
                                                <label className={cn("relative inline-flex items-center cursor-pointer", isReadOnly && "cursor-not-allowed opacity-50")}>
                                                    <input
                                                        type="checkbox"
                                                        checked={showDateColumn}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => setShowDateColumn(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-muted dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground">Prix TTC</span>
                                                <label className={cn("relative inline-flex items-center cursor-pointer", isReadOnly && "cursor-not-allowed opacity-50")}>
                                                    <input
                                                        type="checkbox"
                                                        checked={showTTCColumn}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => setShowTTCColumn(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-muted dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground">Remises</span>
                                                <label className={cn("relative inline-flex items-center cursor-pointer", isReadOnly && "cursor-not-allowed opacity-50")}>
                                                    <input
                                                        type="checkbox"
                                                        checked={discountEnabled}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => setDiscountEnabled(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-muted dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                                </label>
                                            </div>
                                        </div>

                                        {discountEnabled && (
                                            <>
                                                <div className="h-px bg-border dark:bg-white/10" />

                                                {/* Line Discount Type */}
                                                <div className="space-y-2">
                                                    <label className="text-xs text-muted-foreground font-medium uppercase">Type de remise (Lignes)</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={isReadOnly}
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
                                                                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30"
                                                                    : "text-muted-foreground border-border dark:border-white/10 hover:bg-muted/50 dark:hover:bg-white/5",
                                                                isReadOnly && "opacity-50 cursor-not-allowed"
                                                            )}
                                                        >
                                                            Pourcentage (%)
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isReadOnly}
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
                                                                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30"
                                                                    : "text-muted-foreground border-border dark:border-white/10 hover:bg-muted/50 dark:hover:bg-white/5",
                                                                isReadOnly && "opacity-50 cursor-not-allowed"
                                                            )}
                                                        >
                                                            Montant (€)
                                                        </button>
                                                    </div>
                                                </div>


                                            </>
                                        )}

                                        <div className="flex items-center justify-between py-2 border-b border-border dark:border-white/10">
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
                                                        className="w-full h-9 rounded-lg bg-muted/50 border border-border dark:bg-white/5 dark:border-white/10 px-3 text-right text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500 pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(type === "Facture" || type === "Devis") && initialData?.id && (
                            <div title={
                                isHardLocked
                                    ? "Document verrouillé par son statut (Irréversible)"
                                    : isLocked
                                        ? "Cliquez pour déverrouiller"
                                        : "Cliquez pour verrouiller"
                            }>
                                <button
                                    type="button"
                                    onClick={(isHardLocked || isLocking) ? undefined : handleToggleLock}
                                    disabled={isHardLocked || isLocking}
                                    className={cn(
                                        "p-2 rounded-lg transition-all duration-200 border",
                                        isLocked || isHardLocked
                                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                            : "bg-muted/50 dark:bg-white/5 text-muted-foreground border-border dark:border-white/10 hover:bg-muted dark:hover:bg-white/10 hover:text-foreground",
                                        (isHardLocked || isLocking) && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isLocking ? (
                                        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        (isLocked || isHardLocked) ? (
                                            <Lock className="h-5 w-5" />
                                        ) : (
                                            <Unlock className="h-5 w-5" />
                                        )
                                    )}
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handlePreview}
                            className="p-2 rounded-lg border transition-all duration-200 bg-muted/50 dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 cursor-pointer"
                            title="Aperçu PDF"
                        >
                            <Eye className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleGeneratePDF}
                            className="p-2 rounded-lg border transition-all duration-200 bg-muted/50 dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground hover:bg-muted dark:hover:bg-white/10 hover:text-foreground hover:border-border dark:hover:border-white/20 cursor-pointer"
                            title="Télécharger PDF"
                        >
                            <Download className="h-5 w-5" />
                        </button>
                        {(type === "Devis" || type === "Facture") && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setHistoryPanelOpen(true)}
                                    className="p-2 rounded-lg border transition-all duration-200 bg-muted/50 dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 cursor-pointer"
                                    title="Historique des envois"
                                >
                                    <Clock className="h-5 w-5" />
                                </button>
                                {initialData?.emails && initialData.emails.length > 0 && (() => {
                                    const lastSent = [...initialData.emails]
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .find(e => e.status === 'sent');

                                    if (lastSent) {
                                        const dateSent = new Date(lastSent.date);
                                        return (
                                            <div
                                                className="flex flex-col items-end justify-center mr-1.5 cursor-help group leading-3"
                                                title={`Envoyé le ${dateSent.toLocaleDateString()} à ${dateSent.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                            >
                                                <span className="text-[10px] text-muted-foreground/70 mb-0.5">Dernier envoi :</span>
                                                <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                                                    {dateSent.toLocaleDateString()}
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <button
                                    type="button"
                                    onClick={() => {
                                        nextActionRef.current = 'send';
                                        handleSubmit((data) => onSubmit(data))();
                                    }}
                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                                    title={type === "Facture" ? "Envoyer la facture" : "Envoyer le devis"}
                                >
                                    <Send className="h-4 w-4" />
                                    Envoyer
                                </button>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving || isReadOnly || (!!initialData?.id && !isDirty)}
                            className={cn(
                                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 border",
                                // Default Active State
                                (!isSaving && !isReadOnly && !(!!initialData?.id && !isDirty)) && "bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-md border-transparent shadow-sm",
                                // Loading State
                                isSaving && "bg-emerald-600 text-white opacity-80 cursor-wait border-transparent",
                                // Saved State ("Enfoncé"/Feedback)
                                (!!initialData?.id && !isDirty && !isSaving) && "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 shadow-none translate-y-[1px]",
                                // ReadOnly
                                isReadOnly && "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-70"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Enregistrement...
                                </>
                            ) : (!!initialData?.id && !isDirty) ? (
                                <>
                                    <Check className="h-4 w-4" />
                                    Enregistré
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
                            <div className="relative" ref={clientDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => !isReadOnly && setIsClientOpen(!isClientOpen)}
                                    // disabled={isReadOnly} // Removed to prevent native disabled styles
                                    tabIndex={isReadOnly ? -1 : 0}
                                    className={cn(
                                        "w-full h-11 rounded-lg glass-input px-4 text-foreground text-left flex items-center justify-between focus:ring-1 focus:ring-primary/20",
                                        isReadOnly && "opacity-60 pointer-events-none" // Removed cursor-not-allowed, removed border-transparent implication if any
                                    )}
                                >
                                    <span className={!selectedClient ? "text-muted-foreground" : ""}>
                                        {selectedClient ? getClientDisplayName(selectedClient) : "Sélectionner un client..."}
                                    </span>
                                    <ChevronsUpDown className={cn(
                                        "h-4 w-4 text-muted-foreground",
                                        isReadOnly && "invisible"
                                    )} />
                                </button>

                                {isClientOpen && (
                                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border dark:border-white/10 bg-background dark:bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        <div className="p-2 border-b border-border dark:border-white/5">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Rechercher..."
                                                    value={clientSearch}
                                                    onChange={(e) => setClientSearch(e.target.value)}
                                                    className="w-full h-9 rounded-md bg-muted/50 dark:bg-white/5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground border-none focus:ring-1 focus:ring-primary/20"
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
                                                                : "text-foreground hover:bg-muted dark:hover:bg-white/10"
                                                        )}
                                                    >
                                                        {getClientDisplayName(client)}
                                                        {selectedClientId === client.id && (
                                                            <Check className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-2 border-t border-border dark:border-white/5 bg-muted/50 dark:bg-white/5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsClientOpen(false);
                                                    setIsClientModalOpen(true);
                                                }}
                                                className="w-full px-3 py-2 rounded-md text-sm flex items-center gap-2 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Créer un nouveau client
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Hidden select for form registration/validation if needed, or just rely on setValue above */}
                                <input type="hidden" {...register("clientId", { required: "Veuillez sélectionner un client." })} />
                            </div>
                            {errors.clientId && (
                                <p className="text-xs text-red-500 mt-1 animate-in slide-in-from-left-1">{errors.clientId.message}</p>
                            )}

                        </div>

                        <div className="grid grid-cols-3 gap-4 items-end">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground min-h-[20px]">Numéro</label>
                                <input {...register("numero")} readOnly disabled className="w-full h-11 rounded-lg glass-input px-4 text-foreground opacity-60 pointer-events-none" placeholder="Auto-généré" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground min-h-[20px]">
                                    {type === "Facture" ? "Date d'émission" : "Date de création"}
                                </label>
                                <input type="date" {...register("dateEmission", { required: true })} readOnly={isReadOnly} disabled={false} className={cn("w-full h-11 rounded-lg glass-input px-4 text-foreground", isReadOnly && "opacity-60 pointer-events-none")} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground min-h-[20px]">
                                    {type === "Facture" ? "Échéance" : "Date de validité"}
                                </label>
                                <input
                                    type="date"
                                    {...register("echeance", {
                                        onChange: (e) => {
                                            if (type !== "Facture") {
                                                const newDate = new Date(e.target.value);
                                                const emissionDate = new Date(getValues("dateEmission"));

                                                if (!isNaN(newDate.getTime()) && !isNaN(emissionDate.getTime())) {
                                                    const diffTime = newDate.getTime() - emissionDate.getTime();
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                                    let period = "Personnalisé";
                                                    if (diffDays === 0) period = "À réception";
                                                    else if (diffDays === 15) period = "15 jours";
                                                    else if (diffDays === 30) period = "30 jours";
                                                    else if (diffDays === 45) period = "45 jours";
                                                    else if (diffDays === 60) period = "60 jours";

                                                    setValue("conditionsPaiement", period, { shouldDirty: true, shouldTouch: true });
                                                }
                                            }
                                        }
                                    })}

                                    readOnly={isReadOnly}
                                    disabled={false}
                                    className={cn("w-full h-11 rounded-lg glass-input px-4 text-foreground", isReadOnly && "opacity-60 pointer-events-none")}
                                />
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

                        {/* ... existing optional fields div ... */}
                        <div className={cn("space-y-4 animate-in fade-in slide-in-from-top-2 duration-200", !showOptionalFields && "hidden")}>
                            {/* ... content ... */}


                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">
                                        {type === "Facture" ? "Conditions de paiement" : "Période de validité"}
                                    </label>
                                    <select
                                        {...register("conditionsPaiement", {
                                            onChange: (e) => {
                                                const val = e.target.value;
                                                // Auto-calc echeance if needed
                                                if (val) {
                                                    const match = val.match(/(\d+) jours/);
                                                    const days = match ? parseInt(match[1]) : 0;
                                                    if (days > 0) {
                                                        const emissionDate = getValues("dateEmission");
                                                        if (emissionDate) {
                                                            const targetDate = new Date(emissionDate);
                                                            targetDate.setDate(targetDate.getDate() + days);
                                                            setValue("echeance", targetDate.toISOString().split('T')[0], {
                                                                shouldDirty: true,
                                                                shouldTouch: true
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        })}
                                        className={cn("w-full h-11 rounded-lg glass-input px-4 text-foreground cursor-pointer", isReadOnly && "opacity-60 pointer-events-none")}
                                        tabIndex={isReadOnly ? -1 : 0}
                                    >
                                        <option value="">Sélectionner...</option>
                                        <option value="À réception">À réception</option>
                                        <option value="15 jours">15 jours</option>
                                        <option value="30 jours">30 jours</option>
                                        <option value="45 jours">45 jours</option>
                                        <option value="60 jours">60 jours</option>
                                        <option value="Personnalisé">Personnalisé</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Numéro d'enregistrement</label>
                                    <input
                                        {...register("numeroEnregistrement")}
                                        placeholder="Ex : RC123456"
                                        className={cn("w-full h-11 rounded-lg glass-input px-4 text-foreground", isReadOnly && "opacity-60 pointer-events-none")}
                                        readOnly={isReadOnly}
                                        disabled={false}
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
                                                disabled={isReadOnly}
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

                                    {isEditingClient ? (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">Adresse</label>
                                                <input
                                                    type="text"
                                                    value={editedClientData.adresse || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, adresse: e.target.value })}
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">Ville</label>
                                                <input
                                                    type="text"
                                                    value={editedClientData.ville || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, ville: e.target.value })}
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">Code Postal</label>
                                                <input
                                                    type="text"
                                                    value={editedClientData.codePostal || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, codePostal: e.target.value })}
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">Pays</label>
                                                <input
                                                    type="text"
                                                    value={editedClientData.pays || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, pays: e.target.value })}
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    value={editedClientData.email || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, email: e.target.value })}
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">Téléphone</label>
                                                <input
                                                    type="tel"
                                                    value={editedClientData.telephone || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, telephone: e.target.value })}
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">SIRET</label>
                                                <input
                                                    type="text"
                                                    value={editedClientData.siret || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, siret: e.target.value })}
                                                    placeholder="Ex: 123 456 789 00012"
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-muted-foreground mb-1">RCS</label>
                                                <input
                                                    type="text"
                                                    value={editedClientData.rcs || ""}
                                                    onChange={(e) => setEditedClientData({ ...editedClientData, rcs: e.target.value })}
                                                    placeholder="Ex: RCS Paris 123 456 789"
                                                    className="w-full h-9 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:ring-1 focus:ring-blue-500 dark:bg-white/5 dark:border-white/10"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                {/* Placeholder for any strictly full-width field if needed, or just closure */}
                                            </div>
                                        </div>
                                    ) : (
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
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lines */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Lignes de facturation</h3>
                            {errors.items && (
                                <p className="text-xs text-red-500 animate-in slide-in-from-left-1">{errors.items.root?.message || errors.items.message}</p>
                            )}
                        </div>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: [
                                "4fr", // Description
                                showDateColumn ? "1.6fr" : null,
                                showQuantiteColumn ? "0.7fr" : null, // Qté
                                "1.1fr", // P.U HT
                                "1.3fr", // Total HT
                                showTvaColumn ? "0.8fr" : null, // TVA
                                showTTCColumn ? "1.2fr" : null, // Total TTC
                                discountEnabled ? "1.1fr" : null, // Remise
                                "0.4fr"
                            ].filter(Boolean).join(" "),
                            gap: "1rem"
                        }} className="px-2 pl-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            <div>Description</div>
                            {showDateColumn && <div className="text-center">Date</div>}
                            {showQuantiteColumn && <div className="text-center">Qté</div>}
                            <div className="text-right">P.U HT</div>
                            <div className="text-right">Total HT</div>
                            {showTvaColumn && <div className="text-center">TVA</div>}
                            {showTTCColumn && <div className="text-right">Total TTC</div>}
                            {discountEnabled && <div className="text-right">Remise</div>}
                            <div></div>
                        </div>

                        <div className="space-y-2">
                            <Reorder.Group axis="y" values={fields} onReorder={(newOrder) => {
                                // We need to update the form state with the new order
                                // Since useFieldArray doesn't support direct reordering with Reorder.Group values easily,
                                // we use replace() to update the entire array.
                                if (!isReadOnly) replace(newOrder);
                            }}>
                                {fields.map((field, index) => (
                                    <InvoiceLineItem
                                        key={field.id}
                                        field={field as any}
                                        index={index}
                                        showDateColumn={showDateColumn}
                                        showTTCColumn={showTTCColumn}
                                        discountEnabled={discountEnabled}
                                        discountType={discountType}
                                        products={products}
                                        remove={remove}
                                        handleDescriptionChange={handleDescriptionChange}
                                        isReadOnly={isReadOnly}
                                        showQuantiteColumn={showQuantiteColumn}
                                        showTvaColumn={showTvaColumn}
                                    />
                                ))}
                            </Reorder.Group>
                        </div>

                        <button
                            type="button"
                            onClick={() => !isReadOnly && append({
                                id: uuidv4(),
                                description: "",
                                quantite: 1,
                                prixUnitaire: 0,
                                tva: defaultTva,
                                totalLigne: 0,
                                // @ts-ignore
                                type: 'produit',
                                remise: 0,
                                // @ts-ignore
                                remiseType: discountType
                            })}
                            className={cn(
                                "mt-4 flex items-center justify-center w-full py-3 border-2 border-dashed border-border dark:border-white/10 rounded-xl text-muted-foreground hover:text-blue-500 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group",
                                isReadOnly && "invisible pointer-events-none"
                            )}
                        >
                            <Plus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                            Ajouter une ligne
                        </button>
                    </div>

                    <div className="h-px bg-border dark:bg-white/10" />

                    {/* Global Discount Section */}
                    <div className="glass-card rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <input
                                type="checkbox"
                                id="applyGlobalDiscount"
                                checked={(watchedRemiseGlobale || 0) > 0}
                                onChange={(e) => setValue("remiseGlobale", e.target.checked ? 5 : 0)}
                                className="w-4 h-4 rounded border-border dark:border-white/20 bg-muted/50 dark:bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                disabled={isReadOnly}
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
                                            className="flex-1 h-10 rounded-lg bg-muted/50 dark:bg-white/5 border border-border dark:border-white/10 px-3 text-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={isReadOnly}
                                        />
                                        <div className="flex rounded-lg bg-muted/50 dark:bg-white/5 border border-border dark:border-white/10 p-1">
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
                                                disabled={isReadOnly}
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
                                                disabled={isReadOnly}
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
                            <div className="h-px bg-border dark:bg-white/10 my-2" />
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
            </form >

            {/* Gmail-style Compose Window */}
            {
                isComposerOpen && initialData && (type === "Facture" || type === "Devis") && (
                    <div className="fixed bottom-0 right-10 w-[600px] h-[600px] bg-background dark:bg-[#1e1e1e] border border-border dark:border-white/10 rounded-t-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 dark:bg-[#1e1e1e] border-b border-border dark:border-white/10 cursor-pointer" onClick={() => setIsComposerOpen(false)}>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">Nouveau message - {initialData.numero}</span>
                                <button
                                    className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1 transition-colors border border-blue-500/20"
                                    title="Voir l'historique"
                                    onClick={(e) => { e.stopPropagation(); setHistoryPanelOpen(true); }}
                                >
                                    <Clock className="h-3 w-3" />
                                    Historique
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <button className="p-1 hover:bg-muted dark:hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}><Minimize2 className="h-4 w-4" /></button>
                                <button className="p-1 hover:bg-muted dark:hover:bg-white/10 rounded" onClick={(e) => { e.stopPropagation(); setIsComposerOpen(false); }}><X className="h-4 w-4" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-background dark:bg-[#1e1e1e]">
                            <EmailComposer

                                key={draftData ? 'draft-restore' : initialData.id}
                                defaultTo={draftData ? draftData.to : (clients.find(c => c.id === initialData.clientId)?.email || "")}
                                defaultSubject={draftData ? draftData.subject : `${type} ${initialData.numero} - ${societe?.nom} `}
                                defaultMessage={draftData ? draftData.message : `Madame, Monsieur, \n\nVeuillez trouver ci - joint votre ${type === 'Facture' ? 'facture' : 'devis'} n°${initialData.numero}.\n\nCordialement, \n${societe?.nom || ""} `}
                                mainAttachmentName={`${type}_${initialData.numero}.pdf`}
                                onSend={async (data) => {
                                    setIsComposerOpen(false);
                                    await sendEmail(initialData as Facture | Devis, data, {
                                        onSuccess: () => {
                                            refreshData();
                                        }
                                    });

                                }}
                            />
                        </div>
                    </div>
                )
            }

            {/* Auto-open composer effect */}
            {useEffect(() => {
                if (initialData?.id && searchParams.get('action') === 'send') {
                    setIsComposerOpen(true);

                    // Surgical URL cleanup: remove only 'action' parameter
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('action');
                    const newQuery = params.toString();
                    router.replace(`${pathname}${newQuery ? `?${newQuery}` : ''}`, { scroll: false });
                }
            }, [initialData?.id, searchParams, pathname, router]) as any}

            {/* Undo Notification */}
            {
                isUndoVisible && (
                    <div className="fixed bottom-6 right-6 bg-background border border-border text-foreground dark:bg-[#1e1e1e] dark:border-zinc-800 dark:text-white px-6 py-4 rounded-lg shadow-2xl z-[60] flex items-center gap-6 animate-in slide-in-from-bottom-5 duration-300 min-w-[320px]">
                        <div className="flex flex-col">
                            <span className="font-medium">Message envoyé</span>
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
                )
            }

            {/* History Side Panel */}
            <SidePanel
                isOpen={historyPanelOpen}
                onClose={() => setHistoryPanelOpen(false)}
                title={initialData ? `Historique - ${initialData.numero} ` : "Historique"}
            >
                {initialData && (type === "Facture" || type === "Devis") && (
                    <div key={initialData.id}>
                        <CommunicationsPanel
                            invoice={initialData as Facture | Devis}
                            defaultComposeOpen={false}
                            hideComposeButton={true}
                        />
                    </div>
                )}
            </SidePanel>

            <ConfirmationModal
                isOpen={isUnsavedModalOpen}
                onClose={() => setIsUnsavedModalOpen(false)}
                onConfirm={() => router.back()}
                title="Modifications non enregistrées"
                message="Des modifications ont été apportées. Êtes-vous sûr de vouloir quitter sans enregistrer ?"

            />
            {/* Client Creation Slide-in Panel */}
            {isClientModalOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                        onClick={() => setIsClientModalOpen(false)}
                    />
                    {/* Slide-in Panel */}
                    <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-background dark:bg-slate-900 shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
                        <ClientEditor
                            onSuccess={async (newClient) => {
                                setIsClientModalOpen(false);
                                setOptimisticClients(prev => [...prev, newClient]);
                                setValue("clientId", newClient.id);
                                await refreshData();
                            }}
                            onCancel={() => setIsClientModalOpen(false)}
                        />
                    </div>
                </>
            )}
        </FormProvider >
    );
}

function StatusBadge({ status, type, onChange, readOnly }: { status: string, type: "Facture" | "Devis", onChange: (s: string) => void, readOnly?: boolean }) {
    // Restore State
    const [isOpen, setIsOpen] = useState(false);
    const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const getStatusColor = (s: string) => {
        switch (s) {
            case "Accepté":
            case "Facturé":
                return "bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/20";
            case "Payée":
            case "Signé":
            case "Converti":
                return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            case "Envoyée":
            case "Envoyé":
                return "bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/20";
            case "Téléchargée":
            case "Téléchargé":
                return "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD] dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/20";
            case "Refusé":
            case "Annulée":
            case "Perdu":
                return "bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2] dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/20";
            case "Brouillon":
            default:
                return "bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/20";
        }
    };

    const baseOptions = type === "Facture"
        ? ["Brouillon", "Payée", "Annulée"] // "Envoyée" & "Téléchargée" removed - system only
        : ["Brouillon", "Envoyé", "Accepté", "Refusé"]; // "Facturé" removed - system only

    const options = (type === "Facture" && status !== "Brouillon")
        ? baseOptions.filter(opt => {
            if (status === "Annulée") return opt === "Annulée" || opt === "Archivée"; // Strict isolation
            if (status === "Archivée") return opt === "Archivée"; // Strict isolation for Archive
            if (opt === "Brouillon") return false;
            return true;
        })
        : baseOptions;

    // Hard block interactive if status is Annulée (Already handled by readOnly prop passed from Parent, but extra safety here)
    // Archive is also non-interactive
    const isInteractive = !readOnly && status !== "Annulée" && status !== "Archivée";

    return (
        <>
            <div className="relative inline-block ml-3" ref={ref}>
                <button
                    type="button"
                    onClick={() => isInteractive && setIsOpen(!isOpen)}
                    disabled={!isInteractive}
                    className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-2 transition-colors",
                        getStatusColor(status),
                        isInteractive ? "hover:bg-opacity-20 cursor-pointer" : "opacity-80 cursor-default"
                    )}
                >
                    {status}
                    {isInteractive && <ChevronsUpDown className="h-3 w-3 opacity-50" />}
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-40 z-[60] rounded-lg border border-border bg-background/95 backdrop-blur-xl shadow-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                        {options.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                    if (opt === "Annulée") {
                                        setIsOpen(false);
                                        setIsConfirmingCancel(true);
                                    } else {
                                        onChange(opt);
                                        setIsOpen(false);
                                    }
                                }}
                                className={cn(
                                    "w-full text-left px-2 py-1.5 rounded text-sm transition-colors",
                                    status === opt ? "bg-muted dark:bg-white/10 font-medium" : "hover:bg-muted/50 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={isConfirmingCancel}
                onClose={() => setIsConfirmingCancel(false)}
                onConfirm={() => {
                    onChange("Annulée");
                    setIsConfirmingCancel(false);
                }}
                title="Confirmer l'annulation"
                message="Attention : Le statut 'Annulée' est irréversible. La facture passera en lecture seule et ne pourra plus être modifiée. Êtes-vous sûr de vouloir continuer ?"
            />
        </>
    );
}
