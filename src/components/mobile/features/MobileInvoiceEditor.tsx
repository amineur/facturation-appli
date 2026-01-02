"use client";

import { useData } from "@/components/data-provider";
import { generateNextInvoiceNumber, generateNextQuoteNumber } from "@/lib/invoice-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, User, UserPlus, Calendar, FileText, ChevronDown, ChevronUp, Eye, Loader2, Settings, Lock, Unlock, X, Mail } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createInvoice, updateInvoice, toggleInvoiceLock } from "@/lib/actions/invoices";
import { createQuote, updateQuote, toggleQuoteLock } from "@/lib/actions/quotes";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { dataService } from "@/lib/data-service";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { PDFPreviewModal } from '@/components/ui/PDFPreviewModal';
import { EmailHistoryView } from '@/components/features/EmailHistoryView';
import { saveDraft, getDraft } from "@/lib/draft-storage";

interface MobileEditorProps {
    type: "FACTURE" | "DEVIS";
    id?: string;
}

export function MobileEditor({ type, id }: MobileEditorProps) {
    const router = useRouter();
    const { invoices, quotes, clients, products, user, societe, isLoading } = useData();

    // Form State
    const searchParams = useSearchParams();
    const sourceId = searchParams.get("duplicate");

    // -- Data Resolution --
    const initialDoc = id
        ? (type === "FACTURE" ? invoices.find(i => i.id === id) : quotes.find(q => q.id === id))
        : (sourceId ? (type === "FACTURE" ? invoices.find(i => i.id === sourceId) : quotes.find(q => q.id === sourceId)) : null);

    const [hasInitialized, setHasInitialized] = useState(!!initialDoc);

    // Form State (Lazy Init)
    const [selectedClientId, setSelectedClientId] = useState<string>(() => initialDoc?.clientId || "");
    const [items, setItems] = useState<any[]>(() => {
        if (initialDoc?.items) {
            return initialDoc.items.map((i: any) => ({ ...i, id: Math.random() }));
        }
        return [{ id: 1, description: "", quantite: 1, prixUnitaire: 0, tva: 20, remise: 0 }];
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Fields
    const [dateEmission, setDateEmission] = useState(() => {
        if (initialDoc && (initialDoc as any).dateEmission) {
            try { return new Date((initialDoc as any).dateEmission).toISOString().split('T')[0]; } catch (e) { }
        }
        return new Date().toISOString().split('T')[0];
    });

    const [dateEcheance, setDateEcheance] = useState(() => {
        if (initialDoc) {
            const d = type === "FACTURE" ? (initialDoc as any).dateEcheance : (initialDoc as any).dateValidite;
            if (d) {
                try { return new Date(d).toISOString().split('T')[0]; } catch (e) { }
            }
        }
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    });

    const [statut, setStatut] = useState<string>(() => initialDoc?.statut || "Brouillon");
    const [notes, setNotes] = useState(() => initialDoc?.notes || "");
    const [conditions, setConditions] = useState(() => initialDoc?.conditions || "");

    const [conditionsPaiement, setConditionsPaiement] = useState(() => {
        try {
            // Priority 1: Doc Config
            const docConf = initialDoc ? (typeof (initialDoc as any).config === 'string' ? JSON.parse((initialDoc as any).config) : (initialDoc as any).config || {}) : null;
            if (docConf?.conditionsPaiement) return docConf.conditionsPaiement;

            // Priority 2: Global Config (Desktop Sync)
            const globalConf = dataService.getGlobalConfig();
            const defaults = type === "FACTURE" ? globalConf.invoiceDefaults : globalConf.quoteDefaults;
            if ((defaults as any)?.conditionsPaiement) return (defaults as any).conditionsPaiement;

            // Priority 3: Fallback
            return "À réception";
        } catch { return "À réception"; }
    });

    const [datePaiement, setDatePaiement] = useState(() => {
        if (initialDoc && (initialDoc as any).datePaiement) {
            try { return new Date((initialDoc as any).datePaiement).toISOString().split('T')[0]; } catch (e) { }
        }
        return "";
    });

    const [currentDocNumber, setCurrentDocNumber] = useState(() => initialDoc?.numero || "");

    // Configuration State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [rawConfig, setRawConfig] = useState<any>({});
    const [showDateColumn, setShowDateColumn] = useState(false);
    const [showQuantiteColumn, setShowQuantiteColumn] = useState(true);
    const [showTvaColumn, setShowTvaColumn] = useState(true);
    const [showRemiseColumn, setShowRemiseColumn] = useState(false);
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [showTTCColumn, setShowTTCColumn] = useState(false);
    const [discountEnabled, setDiscountEnabled] = useState(false);
    const [discountType, setDiscountType] = useState<'pourcentage' | 'montant'>('pourcentage');
    const [defaultTva, setDefaultTva] = useState(20);

    // Global Discount
    const [remiseGlobale, setRemiseGlobale] = useState(0);
    const [remiseGlobaleType, setRemiseGlobaleType] = useState<'pourcentage' | 'montant'>('pourcentage');


    // Autocomplete State
    const [focusedItemId, setFocusedItemId] = useState<number | null>(null);

    // Lock State
    const [isLocked, setIsLocked] = useState(false);
    const isHardLocked = ["Envoyée", "Payée", "Annulée", "Archivée", "Facturé"].includes(statut);
    const isReadOnly = isHardLocked || isLocked;

    // UI States
    const isReadyToSave = useRef(false);
    const [clientSearch, setClientSearch] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [isSelectingClient, setIsSelectingClient] = useState(false);
    const [isSelectingProduct, setIsSelectingProduct] = useState(false);
    const [expandedItemId, setExpandedItemId] = useState<string | number | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false); // Dates
    const [showCommunications, setShowCommunications] = useState(false); // Communications

    // Preview State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Auto-calculate due date based on payment terms (Mirroring Desktop Logic)
    useEffect(() => {
        if (!dateEmission || !conditionsPaiement || hasInitialized === false) return;

        try {
            const emission = new Date(dateEmission);
            let daysToAdd = 30; // Default

            const match = conditionsPaiement.match(/(\d+)/);
            if (match) {
                daysToAdd = parseInt(match[1]);
            } else if (conditionsPaiement === "À réception") {
                daysToAdd = 0;
            }

            const calculatedDate = new Date(emission);
            calculatedDate.setDate(calculatedDate.getDate() + daysToAdd);
            const formatted = calculatedDate.toISOString().split("T")[0];

            // Only update if different
            if (dateEcheance !== formatted) {
                setDateEcheance(formatted);
            }
        } catch (e) {
            console.error("Date calc error", e);
        }
    }, [dateEmission, conditionsPaiement, hasInitialized]);

    // Initial Load (Edit or Duplicate)
    useEffect(() => {
        if (!hasInitialized) {
            if (id) {
                // Edit Mode
                const doc = type === "FACTURE" ? invoices.find(i => i.id === id) : quotes.find(q => q.id === id);
                if (doc) {
                    let initialItems = (doc.items || []).map((i: any) => ({ ...i, id: i.id || Math.random().toString(36).substr(2, 9) }));
                    let initialClientId = doc.clientId;

                    // DRAFT OVERRIDE CHECK
                    const draft = getDraft(id);
                    if (draft) {
                        // Check timestamps.
                        const serverTime = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;

                        if (draft.updatedAt > serverTime) {
                            console.log("[MOBILE] Init: Found newer draft, applying override...", {
                                draftDate: draft.updatedAt,
                                serverDate: serverTime
                            });
                            if (draft.items) initialItems = draft.items;
                            if (draft.clientId) initialClientId = draft.clientId;

                            // Inject draft config into initial variables to avoid race conditions with separate Restore effect
                            if (draft.showDateColumn !== undefined) doc.config = { ...doc.config, showDateColumn: draft.showDateColumn };
                            if (draft.showTTCColumn !== undefined) doc.config = { ...doc.config, showTTCColumn: draft.showTTCColumn };
                            if (draft.showQuantiteColumn !== undefined) doc.config = { ...doc.config, showQuantiteColumn: draft.showQuantiteColumn };
                            if (draft.showTvaColumn !== undefined) (doc as any).config = { ...(doc as any).config, showTvaColumn: draft.showTvaColumn };
                            if (draft.showRemiseColumn !== undefined) (doc as any).config = { ...(doc as any).config, showRemiseColumn: draft.showRemiseColumn };
                            if (draft.showOptionalFields !== undefined) (doc as any).config = { ...(doc as any).config, showOptionalFields: draft.showOptionalFields };
                            if (draft.discountEnabled !== undefined) (doc as any).config = { ...(doc as any).config, discountEnabled: draft.discountEnabled };
                            if (draft.discountType) (doc as any).config = { ...(doc as any).config, discountType: draft.discountType };
                            if (draft.defaultTva !== undefined) (doc as any).config = { ...(doc as any).config, defaultTva: draft.defaultTva };
                            if (draft.conditionsPaiement) (doc as any).conditionsPaiement = draft.conditionsPaiement;
                            if (draft.notes) (doc as any).notes = draft.notes;
                        }
                    }

                    setSelectedClientId(initialClientId);
                    setItems(initialItems);

                    if ((doc as any).dateEmission) {
                        try { setDateEmission(new Date((doc as any).dateEmission).toISOString().split('T')[0]); } catch (e) { }
                    }

                    const echeance = type === "FACTURE" ? (doc as any).dateEcheance : (doc as any).dateValidite;
                    if (echeance) {
                        try { setDateEcheance(new Date(echeance).toISOString().split('T')[0]); } catch (e) { }
                    }

                    setStatut(doc.statut);
                    setNotes(doc.notes || "");
                    setConditions(doc.conditions || "");
                    setCurrentDocNumber(doc.numero);
                    if ((doc as any).datePaiement) {
                        try { setDatePaiement(new Date((doc as any).datePaiement).toISOString().split('T')[0]); } catch (e) { }
                    }

                    // Config & Lock
                    const conf = (doc as any).config || {};
                    // Handle string config if legacy
                    const parsedConf = typeof conf === 'string' ? JSON.parse(conf) : conf;

                    setRawConfig(parsedConf || {});
                    setShowDateColumn(parsedConf?.showDateColumn ?? false);
                    setShowTTCColumn(parsedConf?.showTTCColumn ?? false);
                    setDiscountEnabled(parsedConf?.discountEnabled ?? false);
                    setDefaultTva(parsedConf?.defaultTva ?? 20);

                    // Handle Conditions Paiement from config if available (it overwrites basic state if present)
                    // The basic state 'conditionsPaiement' is passed to config on save.
                    // On load, we should trust config IF present, else default.
                    if (parsedConf?.conditionsPaiement) setConditionsPaiement(parsedConf.conditionsPaiement);
                    else {
                        try {
                            // Fallback attempts
                            const oldConf = typeof (doc as any).config === 'string' ? JSON.parse((doc as any).config) : (doc as any).config || {};
                            if (oldConf.conditionsPaiement) setConditionsPaiement(oldConf.conditionsPaiement);
                        } catch (e) { }
                    }

                    setIsLocked(!!doc.isLocked);

                    setHasInitialized(true);
                }
            } else if (sourceId) {
                // Duplicate Mode
                const doc = type === "FACTURE" ? invoices.find(i => i.id === sourceId) : quotes.find(q => q.id === sourceId);
                if (doc) {
                    setSelectedClientId(doc.clientId);
                    setItems((doc.items || []).map((i: any) => ({ ...i, id: Math.random().toString(36).substr(2, 9) })));
                    setNotes(doc.notes || "");
                    setConditions(doc.conditions || "");

                    // Config from source
                    const conf = (doc as any).config || {};
                    const parsedConf = typeof conf === 'string' ? JSON.parse(conf) : conf;

                    setRawConfig(parsedConf || {});
                    setShowDateColumn(parsedConf?.showDateColumn ?? false);
                    setShowTTCColumn(parsedConf?.showTTCColumn ?? false);
                    setDiscountEnabled(parsedConf?.discountEnabled ?? false);
                    setDefaultTva(parsedConf?.defaultTva ?? 20);
                    if (parsedConf?.conditionsPaiement) setConditionsPaiement(parsedConf.conditionsPaiement);

                    // Initialize global discount from source?
                    // Usually we don't copy global discount on duplicate? 
                    // Desktop duplication usually keeps item details but maybe resets global stuffs?
                    // Safe verification: InvoiceEditor.tsx `buildFormDefaults` copies `remiseGlobale`.
                    setRemiseGlobale(doc.remiseGlobale || 0);
                    setRemiseGlobaleType((doc as any).remiseGlobaleType || 'pourcentage');

                    // Do not copy locked state
                    setIsLocked(false);
                }
            } else {
                // Defaults for new doc
                const globalConfig = dataService.getGlobalConfig();
                const defaults = type === "FACTURE" ? globalConfig.invoiceDefaults : globalConfig.quoteDefaults;
                setShowDateColumn(defaults?.showDate ?? globalConfig.showDateColumn ?? false);
                setShowTTCColumn(defaults?.showTtc ?? globalConfig.showTTCColumn ?? false);
                setDiscountEnabled(defaults?.showRemise ?? globalConfig.discountEnabled ?? false);
                setDiscountType(globalConfig.discountType || 'pourcentage');
                setDefaultTva(globalConfig.defaultTva ?? 20);

                // Generate document number for new documents
                if (!sourceId) {
                    const nextNumber = type === "FACTURE"
                        ? generateNextInvoiceNumber(invoices)
                        : generateNextQuoteNumber(quotes);
                    setCurrentDocNumber(nextNumber);
                }

                // Init raw config empty so we don't carry garbage
                setRawConfig({});
            }
        }
    }, [id, sourceId, type, invoices, quotes, hasInitialized]);

    // -- Auto-Save / Restore Logic --

    // 1. Restore on Mount
    useEffect(() => {
        const draft = getDraft(id || 'new');
        if (draft) {
            // Conflict resolution: Server wins if newer for existing docs
            if (id && invoices && quotes) { // Ensure data is loaded
                const currentDoc = type === "FACTURE" ? invoices.find(i => i.id === id) : quotes.find(q => q.id === id);
                if (currentDoc && currentDoc.updatedAt) {
                    const serverTime = new Date(currentDoc.updatedAt).getTime();
                    if (serverTime > draft.updatedAt) {
                        // Server is newer, ignore draft
                        return;
                    }
                }
            }

            console.log("[MOBILE] Restoring draft to State...");
            if (draft.items) setItems(draft.items);
            if (draft.clientId) setSelectedClientId(draft.clientId);

            // Restore proper date objects/strings
            if (draft.dateEmission) {
                // Ensure it is a valid date string YYYY-MM-DD
                try {
                    // Check if ISO full or YYYY-MM-DD
                    const d = new Date(draft.dateEmission);
                    if (!isNaN(d.getTime())) {
                        setDateEmission(d.toISOString().split('T')[0]);
                    }
                } catch (e) { }
            }
            if (draft.echeance) {
                try {
                    const d = new Date(draft.echeance);
                    if (!isNaN(d.getTime())) setDateEcheance(d.toISOString().split('T')[0]);
                } catch (e) { }
            }

            if (draft.conditionsPaiement) setConditionsPaiement(draft.conditionsPaiement);
            if (draft.notes) setNotes(draft.notes);
            if (draft.remiseGlobale !== undefined) setRemiseGlobale(draft.remiseGlobale);
            if (draft.remiseGlobaleType) setRemiseGlobaleType(draft.remiseGlobaleType);

            // Config
            if (draft.defaultTva !== undefined) setDefaultTva(draft.defaultTva);
            if (draft.showDateColumn !== undefined) setShowDateColumn(draft.showDateColumn);
            if (draft.showTvaColumn !== undefined) setShowTvaColumn(draft.showTvaColumn);
            if (draft.showQuantiteColumn !== undefined) setShowQuantiteColumn(draft.showQuantiteColumn);
            if (draft.showRemiseColumn !== undefined) setShowRemiseColumn(draft.showRemiseColumn);
            if (draft.showOptionalFields !== undefined) setShowOptionalFields(draft.showOptionalFields);
            if (draft.showTTCColumn !== undefined) setShowTTCColumn(draft.showTTCColumn);
            if (draft.discountEnabled !== undefined) setDiscountEnabled(draft.discountEnabled);
            if (draft.discountType) setDiscountType(draft.discountType);

            if (!hasInitialized) setHasInitialized(true);

            // Force Sync draftRef to prevents race conditions where save triggers before next render
            draftRef.current = {
                items: draft.items || items,
                clientId: draft.clientId || selectedClientId,
                dateEmission: draft.dateEmission ? (new Date(draft.dateEmission).toISOString().split('T')[0]) : dateEmission,
                echeance: dateEcheance, // Simplification: assume echeance state update is enough or user didn't change it yet
                conditionsPaiement: draft.conditionsPaiement || conditionsPaiement,
                notes: draft.notes || notes,
                remiseGlobale: draft.remiseGlobale ?? remiseGlobale,
                remiseGlobaleType: draft.remiseGlobaleType || remiseGlobaleType,
                defaultTva: draft.defaultTva ?? defaultTva,
                showDateColumn: draft.showDateColumn ?? showDateColumn,
                showTvaColumn: draft.showTvaColumn ?? showTvaColumn,
                showQuantiteColumn: draft.showQuantiteColumn ?? showQuantiteColumn,
                showRemiseColumn: draft.showRemiseColumn ?? showRemiseColumn,
                showOptionalFields: draft.showOptionalFields ?? showOptionalFields,
                showTTCColumn: draft.showTTCColumn ?? showTTCColumn,
                discountEnabled: draft.discountEnabled ?? discountEnabled,
                discountType: draft.discountType || discountType
            };
            isReadyToSave.current = true;
            console.log("[MOBILE] Draft Restoration Complete & Safe.");
        } else {
            // No draft found -> We are ready to save new changes (defaults)
            isReadyToSave.current = true;
        }
    }, [id]); // Check only on mount/id change

    // 2. Auto-Save on Change
    // 2. Auto-Save Logic with Unmount Protection

    const draftData = {
        items,
        clientId: selectedClientId,
        dateEmission,
        echeance: dateEcheance,
        conditionsPaiement,
        notes,
        remiseGlobale,
        remiseGlobaleType,
        defaultTva,
        showDateColumn,
        showTvaColumn,
        showQuantiteColumn,
        showRemiseColumn,
        showOptionalFields,
        showTTCColumn,
        discountEnabled,
        discountType
    };

    const draftRef = useRef(draftData);

    // Update ref on every render
    useLayoutEffect(() => {
        draftRef.current = draftData;
    });

    // Save on Unmount (Force Sync)
    useEffect(() => {
        return () => {
            if (isReadOnly) return;
            if (!isReadyToSave.current) {
                console.warn("[MOBILE] Unmount Save SKIPPED - Not Ready");
                return;
            }
            console.log("[MOBILE] Unmounting - forcing save...", draftRef.current);
            saveDraft(id || 'new', draftRef.current);
        };
    }, [id, isReadOnly]);

    // Auto-Save on Change (Debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isReadOnly) return;
            if (!isReadyToSave.current) {
                // Skip initial auto-saves until ready
                return;
            }
            console.log("[MOBILE] Auto-saving draft...", { itemsCount: items.length, tva: defaultTva });
            saveDraft(id || 'new', draftData);
        }, 500);
        return () => clearTimeout(timer);
    }, [items, selectedClientId, dateEmission, dateEcheance, conditionsPaiement, notes, remiseGlobale, remiseGlobaleType, defaultTva, showDateColumn, showTvaColumn, showQuantiteColumn, showRemiseColumn, showOptionalFields, showTTCColumn, discountEnabled, discountType, isReadOnly, id]);

    const handleAddItem = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        setItems([...items, { id: newId, description: "", quantite: 1, prixUnitaire: 0, tva: defaultTva, remise: 0 }]); // Use defaultTva state
        setExpandedItemId(newId); // Auto expand new item
    };

    const handleUpdateItem = (id: any, field: string, value: any) => {
        if (isReadOnly) return;
        setItems(prevItems => prevItems.map(item =>
            item.id == id ? { ...item, [field]: value } : item
        ));
    };

    const handleRemoveItem = (id: number) => {
        if (isReadOnly) return;
        setItems(items.filter(item => item.id !== id));
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => {
            const h = Number(item.quantite) * Number(item.prixUnitaire);
            const r = h * (Number(item.remise || 0) / 100);
            const ht = h - r;
            const tvaAmt = ht * (Number(item.tva || 0) / 100);
            return sum + ht + tvaAmt;
        }, 0);
    };

    const handlePreview = () => {
        if (!selectedClientId) {
            toast.error("Veuillez sélectionner un client d'abord");
            return;
        }
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !societe) return;

        const totalTTC = calculateTotal();
        const totalHT = items.reduce((sum, i) => sum + (Number(i.quantite) * Number(i.prixUnitaire) * (1 - Number(i.remise || 0) / 100)), 0);

        const mappedItems = items.map(i => ({
            ...i,
            prixUnitaire: Number(i.prixUnitaire),
            quantite: Number(i.quantite),
            tva: Number(i.tva),
            remise: Number(i.remise || 0),
            totalLigne: Number(i.quantite) * Number(i.prixUnitaire)
        }));

        const mockDoc: any = {
            id: id || "preview",
            numero: currentDocNumber || "PREVIEW",
            type: type,
            dateEmission: new Date(dateEmission).toISOString(),
            clientId: selectedClientId,
            items: mappedItems,
            notes,
            conditions,
            statut,
            totalHT,
            totalTTC,
            config: JSON.stringify({ conditionsPaiement }),
            docType: type // Helper for generator if needed
        };

        if (type === "FACTURE") {
            mockDoc.echeance = new Date(dateEcheance).toISOString();
            if (datePaiement) mockDoc.datePaiement = new Date(datePaiement).toISOString();
        } else {
            mockDoc.dateValidite = new Date(dateEcheance).toISOString();
        }

        const url = generateInvoicePDF(mockDoc, societe, client, { returnBlob: true });
        if (url && typeof url === 'string') {
            setPreviewUrl(url);
        }
    };

    const handleToggleLock = async () => {
        if (!id) return; // Cannot lock unsaved

        // Optimistic toggle? No, Desktop saves first.
        // We will call handleChangeSave logic but forcing lock state.
        // Or simpler: Reuse handleSave logic.
        // We must override the `isLocked` state in the payload.

        setIsSubmitting(true);
        try {
            const nextState = !isLocked;
            await saveDocument(nextState); // New helper
            setIsLocked(nextState); // Update local state only after success
            // Server lock call is done inside saveDocument or we do it here?
            // Desktop: Save -> Then Call ToggleLock Action.

            // Let's create a dedicated saveAndLock function or refactor handleSave.
            // For minimal risk, I'll inline the logic here mimicking handleSave.
        } catch (e) {
            toast.error("Erreur lors du verrouillage");
            setIsSubmitting(false);
        }
    };

    // Extracted calculation logic
    const calculateTotals = () => {
        let htAvantRemiseGlobale = 0;
        let remiseLignesTotal = 0;

        items.forEach(item => {
            const q = Number(item.quantite || 0);
            const p = Number(item.prixUnitaire || 0);
            const montantAvantRemise = q * p;
            let remiseLigne = 0;

            if (discountEnabled && item.remise && Number(item.remise) > 0) {
                if (discountType === 'montant') {
                    remiseLigne = Number(item.remise);
                } else {
                    remiseLigne = montantAvantRemise * (Number(item.remise) / 100);
                }
            }
            remiseLignesTotal += remiseLigne;
            htAvantRemiseGlobale += Math.max(0, montantAvantRemise - remiseLigne);
        });

        let remiseGlobaleMontant = 0;
        if (remiseGlobale && remiseGlobale > 0) {
            if (remiseGlobaleType === 'montant') {
                remiseGlobaleMontant = remiseGlobale;
            } else {
                remiseGlobaleMontant = htAvantRemiseGlobale * (remiseGlobale / 100);
            }
        }

        const globalDiscountRatio = htAvantRemiseGlobale > 0
            ? Math.max(0, 1 - (remiseGlobaleMontant / htAvantRemiseGlobale))
            : 1;

        const htNet = Math.max(0, htAvantRemiseGlobale - remiseGlobaleMontant);

        const tva = items.reduce((acc, item) => {
            const q = Number(item.quantite || 0);
            const p = Number(item.prixUnitaire || 0);
            const montantAvantRemise = q * p;
            let remiseLigne = 0;
            if (discountEnabled && item.remise && Number(item.remise) > 0) {
                if (discountType === 'montant') {
                    remiseLigne = Number(item.remise);
                } else {
                    remiseLigne = montantAvantRemise * (Number(item.remise) / 100);
                }
            }
            const montantLigneNet = Math.max(0, montantAvantRemise - remiseLigne);
            const montantLigneFinal = montantLigneNet * globalDiscountRatio;
            return acc + (montantLigneFinal * (Number(item.tva || 0) / 100));
        }, 0);

        return {
            totalHT: htNet,
            totalTVA: tva,
            totalTTC: htNet + tva,
            htAvantRemiseGlobale,
            remiseLignesTotal,
            remiseGlobaleMontant
        };
    };

    const saveDocument = async (nextLockState?: boolean) => {
        if (!selectedClientId) {
            toast.error("Veuillez sélectionner un client");
            return;
        }

        const totals = calculateTotals();
        const targetLockState = nextLockState !== undefined ? nextLockState : isLocked;

        const payload: any = {
            clientId: selectedClientId,
            items: items.map(i => ({ ...i, id: typeof i.id === 'string' && i.id.length > 10 ? undefined : i.id })),
            dateEmission: new Date(dateEmission).toISOString(),
            notes,
            conditions,
            statut,
            totalHT: totals.totalHT,
            totalTVA: totals.totalTVA,
            totalTTC: totals.totalTTC,
            remiseGlobale: remiseGlobale,
            remiseGlobaleType: remiseGlobaleType,
            remiseGlobaleMontant: totals.remiseGlobaleMontant,
            config: JSON.stringify({
                ...rawConfig,
                conditionsPaiement,
                showDateColumn,
                showTTCColumn,
                discountEnabled,
                discountType,
                defaultTva
            }),
            isLocked: targetLockState,
            societeId: societe?.id,
            type: type
        };

        if (type === "FACTURE") {
            payload.dateEcheance = new Date(dateEcheance).toISOString();
            payload.numero = currentDocNumber || generateNextInvoiceNumber(invoices);
        } else {
            payload.dateValidite = new Date(dateEcheance).toISOString();
            payload.numero = currentDocNumber || generateNextQuoteNumber(quotes);
        }

        if (type === "FACTURE" && statut === "Payée" && datePaiement) {
            payload.datePaiement = new Date(datePaiement).toISOString();
        }

        if (id) {
            // Update
            payload.id = id;
            // payload.numero = currentDocNumber; // Keep existing number - already in payload

            if (type === "FACTURE") await updateInvoice(payload);
            else await updateQuote(payload);

            if (nextLockState !== undefined) {
                if (type === "FACTURE") await toggleInvoiceLock(id, nextLockState);
                else await toggleQuoteLock(id, nextLockState);
                toast.success(nextLockState ? "Verrouillé" : "Déverrouillé");
            } else {

            }
            // No toast here if not locking, handleSave does it? 
            // Better to toast here if handleSave calls this.
            if (nextLockState === undefined) toast.success("Enregistré");

        } else {
            // Create
            if (type === "FACTURE") {
                const res = await createInvoice(payload);
                if (res?.id) {
                    toast.success("Facture créée");
                    router.push("/factures");
                }
            } else {
                const res = await createQuote(payload);
                if (res?.id) {
                    toast.success("Devis créé");
                    router.push("/devis");
                }
            }
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await saveDocument();
        } catch (error) {
            console.error(error);
            toast.error("Erreur d'enregistrement");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading State
    if (isLoading && !initialDoc && (id || sourceId)) {
        return (
            <div className="min-h-screen bg-muted/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Locked View
    if (isReadOnly && !isSettingsOpen) {
        // Maybe show a banner?
    }

    // Configuration View (Bottom Sheet)
    if (isSettingsOpen) {
        return (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsSettingsOpen(false)}
                />

                {/* Sheet */}
                <div className="relative w-full max-w-lg bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">

                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 p-4 flex items-center justify-between">
                        <h2 className="font-bold text-lg">Configuration</h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="p-2 -mr-2 rounded-full hover:bg-muted bg-muted/50">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-4 space-y-6 pb-12">
                        {/* Columns Section */}
                        <section className="space-y-3">
                            <h3 className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Colonnes</h3>

                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                                <span className="font-medium">Date prestation</span>
                                <div className={cn("w-12 h-7 rounded-full transition-all relative border-2", showDateColumn ? "bg-primary border-primary" : "bg-zinc-200 border-zinc-200 dark:bg-zinc-700 dark:border-zinc-700", isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} onClick={() => !isReadOnly && setShowDateColumn(!showDateColumn)}>
                                    <div className={cn("absolute top-0.5 left-0.5 bg-white h-5 w-5 rounded-full transition-transform shadow-sm", showDateColumn && "translate-x-5")} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                                <span className="font-medium">Prix TTC</span>
                                <div className={cn("w-12 h-7 rounded-full transition-all relative border-2", showTTCColumn ? "bg-primary border-primary" : "bg-zinc-200 border-zinc-200 dark:bg-zinc-700 dark:border-zinc-700", isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} onClick={() => !isReadOnly && setShowTTCColumn(!showTTCColumn)}>
                                    <div className={cn("absolute top-0.5 left-0.5 bg-white h-5 w-5 rounded-full transition-transform shadow-sm", showTTCColumn && "translate-x-5")} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                                <span className="font-medium">Colonne Quantité</span>
                                <div className={cn("w-12 h-7 rounded-full transition-all relative border-2", showQuantiteColumn ? "bg-primary border-primary" : "bg-zinc-200 border-zinc-200 dark:bg-zinc-700 dark:border-zinc-700", isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} onClick={() => !isReadOnly && setShowQuantiteColumn(!showQuantiteColumn)}>
                                    <div className={cn("absolute top-0.5 left-0.5 bg-white h-5 w-5 rounded-full transition-transform shadow-sm", showQuantiteColumn && "translate-x-5")} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                                <span className="font-medium">Colonne TVA</span>
                                <div className={cn("w-12 h-7 rounded-full transition-all relative border-2", showTvaColumn ? "bg-primary border-primary" : "bg-zinc-200 border-zinc-200 dark:bg-zinc-700 dark:border-zinc-700", isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} onClick={() => !isReadOnly && setShowTvaColumn(!showTvaColumn)}>
                                    <div className={cn("absolute top-0.5 left-0.5 bg-white h-5 w-5 rounded-full transition-transform shadow-sm", showTvaColumn && "translate-x-5")} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                                <span className="font-medium">Remises (Lignes)</span>
                                <div className={cn("w-12 h-7 rounded-full transition-all relative border-2", discountEnabled ? "bg-primary border-primary" : "bg-zinc-200 border-zinc-200 dark:bg-zinc-700 dark:border-zinc-700", isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer")} onClick={() => !isReadOnly && setDiscountEnabled(!discountEnabled)}>
                                    <div className={cn("absolute top-0.5 left-0.5 bg-white h-5 w-5 rounded-full transition-transform shadow-sm", discountEnabled && "translate-x-5")} />
                                </div>
                            </div>

                            {discountEnabled && (
                                <div className="p-3 bg-muted/20 rounded-xl border space-y-2 animate-in slide-in-from-top-2">
                                    <span className="text-xs font-medium uppercase text-muted-foreground">Type de remise (Lignes)</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => !isReadOnly && setDiscountType('pourcentage')}
                                            disabled={isReadOnly}
                                            className={cn("p-2 rounded-lg text-xs font-bold border transition-colors", discountType === 'pourcentage' ? "bg-primary/10 border-primary text-primary" : "bg-background border-border", isReadOnly && "opacity-50")}
                                        >
                                            Pourcentage (%)
                                        </button>
                                        <button
                                            onClick={() => !isReadOnly && setDiscountType('montant')}
                                            disabled={isReadOnly}
                                            className={cn("p-2 rounded-lg text-xs font-bold border transition-colors", discountType === 'montant' ? "bg-primary/10 border-primary text-primary" : "bg-background border-border", isReadOnly && "opacity-50")}
                                        >
                                            Montant (€)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Defaults Section */}
                        <section className="space-y-3">
                            <h3 className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Valeurs par défaut</h3>
                            <div>
                                <label className="text-xs font-medium mb-1 block">TVA par défaut (%)</label>
                                <input
                                    type="number"
                                    className="w-full bg-muted/20 border rounded-xl p-3"
                                    value={defaultTva}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setDefaultTva(val);
                                        // Also update existing items to match user expectation of "changing document VAT"
                                        if (!isNaN(val)) {
                                            setItems(prev => prev.map(item => ({ ...item, tva: val })));
                                        }
                                    }}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </section>

                        <button onClick={() => setIsSettingsOpen(false)} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl mt-4">
                            Terminer
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Client Selection View
    if (isSelectingClient) {
        const filteredClients = clients.filter(c => c.nom.toLowerCase().includes(clientSearch.toLowerCase()));
        return (
            <div className="min-h-screen bg-background p-4 flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setIsSelectingClient(false)} className="p-2 -ml-2"><ArrowLeft /></button>
                    <input
                        autoFocus
                        placeholder="Rechercher client..."
                        className="flex-1 bg-transparent border-none text-lg focus:outline-none"
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pb-20">
                    {filteredClients.map(client => (
                        <button
                            key={client.id}
                            onClick={() => { setSelectedClientId(client.id); setIsSelectingClient(false); }}
                            className="w-full text-left p-4 rounded-xl bg-card border border-border flex items-center gap-3"
                        >
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                {client.nom[0]}
                            </div>
                            <div>
                                <p className="font-bold">{client.nom}</p>
                                <p className="text-xs text-muted-foreground">{client.email}</p>
                            </div>
                        </button>
                    ))}
                    <Link href="/clients/new" className="w-full text-left p-4 rounded-xl border border-dashed border-primary/50 flex items-center gap-3 text-primary">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center"><UserPlus /></div>
                        <span className="font-bold">Créer nouveau client</span>
                    </Link>
                </div>
            </div>
        );
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);

    // Product Selection View
    if (isSelectingProduct) {
        const filteredProducts = (products || []).filter(p => p.nom.toLowerCase().includes(productSearch.toLowerCase()));
        return (
            <div className="min-h-screen bg-background p-4 flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setIsSelectingProduct(false)} className="p-2 -ml-2"><ArrowLeft /></button>
                    <input
                        autoFocus
                        placeholder="Rechercher produit..."
                        className="flex-1 bg-transparent border-none text-lg focus:outline-none"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pb-20">
                    {filteredProducts.map(product => (
                        <button
                            key={product.id}
                            onClick={() => {
                                const newId = Date.now();
                                setItems([...items, {
                                    id: newId,
                                    description: product.nom,
                                    quantite: 1,
                                    prixUnitaire: product.prixUnitaire,
                                    tva: product.tva || 20,
                                    remise: 0
                                }]);
                                setExpandedItemId(newId);
                                setIsSelectingProduct(false);
                                toast.success("Produit ajouté");
                            }}
                            className="w-full text-left p-4 rounded-xl bg-card border border-border flex items-center gap-3"
                        >
                            <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-500">
                                {product.nom[0]}
                            </div>
                            <div>
                                <p className="font-bold">{product.nom}</p>
                                <p className="text-xs text-muted-foreground">{product.prixUnitaire}€ HT</p>
                            </div>
                        </button>
                    ))}
                    <Link href="/produits/new" className="w-full text-left p-4 rounded-xl border border-dashed border-indigo-500/50 flex items-center gap-3 text-indigo-500">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center"><Plus /></div>
                        <span className="font-bold">Créer nouveau produit</span>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/10 pb-40">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50 p-4 flex items-center justify-between">
                <Link href={type === "FACTURE" ? "/factures" : "/devis"} className="p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-sm">{id ? "Modifier" : (type === "FACTURE" ? "Nouvelle" : "Nouveau")} {type === "FACTURE" ? "Facture" : "Devis"}</span>
                    {currentDocNumber && <span className="text-[10px] text-muted-foreground">{currentDocNumber}</span>}
                </div>

                <div className="flex items-center gap-1 -mr-2">
                    <button onClick={handleToggleLock} className="p-2 rounded-full hover:bg-muted text-muted-foreground" disabled={!id}>
                        {isLocked ? <Lock className="h-5 w-5 text-orange-500" /> : <Unlock className="h-5 w-5" />}
                    </button>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-muted text-primary">
                        <Settings className="h-5 w-5" />
                    </button>
                    <button onClick={handlePreview} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
                        <Eye className="h-6 w-6" />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Client Selector */}
                {selectedClient ? (
                    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg shrink-0">
                                    {selectedClient.nom[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-base">{selectedClient.nom}</p>
                                    {selectedClient.email && (
                                        <p className="text-xs text-muted-foreground truncate">{selectedClient.email}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSelectingClient(true)}
                                disabled={isReadOnly}
                                className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <User className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Client Details */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
                            {selectedClient.email && (
                                <div className="text-xs">
                                    <p className="text-muted-foreground font-medium mb-1">Email</p>
                                    <p className="text-foreground">{selectedClient.email}</p>
                                </div>
                            )}
                            {selectedClient.telephone && (
                                <div className="text-xs">
                                    <p className="text-muted-foreground font-medium mb-1">Téléphone</p>
                                    <p className="text-foreground">{selectedClient.telephone}</p>
                                </div>
                            )}
                            {selectedClient.adresse && (
                                <div className="text-xs">
                                    <p className="text-muted-foreground font-medium mb-1">Adresse</p>
                                    <p className="text-foreground">{selectedClient.adresse}</p>
                                    {selectedClient.codePostal && selectedClient.ville && (
                                        <p className="text-foreground">{selectedClient.codePostal} {selectedClient.ville}</p>
                                    )}
                                </div>
                            )}
                            {selectedClient.siret && (
                                <div className="text-xs">
                                    <p className="text-muted-foreground font-medium mb-1">SIRET</p>
                                    <p className="text-foreground">{selectedClient.siret}</p>
                                </div>
                            )}
                            {selectedClient.tvaIntracom && (
                                <div className="text-xs">
                                    <p className="text-muted-foreground font-medium mb-1">TVA Intracommunautaire</p>
                                    <p className="text-foreground">{selectedClient.tvaIntracom}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsSelectingClient(true)}
                        disabled={isReadOnly}
                        className="w-full p-4 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 flex items-center gap-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-muted-foreground">Sélectionner un client</span>
                    </button>
                )}


                {/* Status - Only visible when editing existing document */}
                {id && (
                    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase mb-2 block">Statut</label>
                        <select
                            value={statut}
                            onChange={e => setStatut(e.target.value)}
                            disabled={isReadOnly}
                            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm font-medium"
                        >
                            <option value="Brouillon">Brouillon</option>
                            <option value="Envoyée">Envoyée</option>
                            {type === "FACTURE" ? (
                                <>
                                    <option value="Payée">Payée</option>
                                    <option value="En retard">En retard</option>
                                    <option value="Annulée">Annulée</option>
                                </>
                            ) : (
                                <>
                                    <option value="Accepté">Accepté</option>
                                    <option value="Refusé">Refusé</option>
                                </>
                            )}
                        </select>
                    </div>
                )}

                {/* Dates */}
                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center justify-between w-full"
                    >
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Dates
                        </h3>
                        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showAdvanced && (
                        <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">Émission</label>
                                    <input
                                        type="date"
                                        value={dateEmission}
                                        onChange={e => setDateEmission(e.target.value)}
                                        disabled={isReadOnly}
                                        className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">Condition de paiement</label>
                                    <select
                                        value={conditionsPaiement}
                                        onChange={e => setConditionsPaiement(e.target.value)}
                                        disabled={isReadOnly}
                                        className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
                                    >
                                        <option value="À réception">À réception</option>
                                        <option value="15 jours">15 jours</option>
                                        <option value="30 jours">30 jours</option>
                                        <option value="45 jours">45 jours</option>
                                        <option value="60 jours">60 jours</option>
                                        <option value="Personnalisé">Personnalisé</option>
                                        {/* Preserve existing if custom */}
                                        {!["À réception", "15 jours", "30 jours", "45 jours", "60 jours", "Personnalisé"].includes(conditionsPaiement) && conditionsPaiement && (
                                            <option value={conditionsPaiement}>{conditionsPaiement}</option>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">
                                        {type === "FACTURE" ? "Échéance" : "Validité"}
                                    </label>
                                    <input
                                        type="date"
                                        value={dateEcheance}
                                        onChange={e => setDateEcheance(e.target.value)}
                                        disabled={isReadOnly}
                                        className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            {type === "FACTURE" && statut === "Payée" && (
                                <div className="col-span-2 animate-in slide-in-from-top-2">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">Date de paiement</label>
                                    <input
                                        type="date"
                                        value={datePaiement}
                                        onChange={e => setDatePaiement(e.target.value)}
                                        disabled={isReadOnly}
                                        className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Communications - Only for existing documents */}
                {id && (
                    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                        <button
                            onClick={() => setShowCommunications(!showCommunications)}
                            className="flex items-center justify-between w-full"
                        >
                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Communications
                            </h3>
                            {showCommunications ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {showCommunications && (
                            <div className="pt-2 space-y-3 animate-in slide-in-from-top-2">
                                <EmailHistoryView emails={initialDoc?.emails || []} />

                                {statut !== 'Annulée' && (
                                    <button
                                        onClick={() => toast.info("Fonctionnalité d'envoi d'email à venir")}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-lg transition-all text-sm font-medium"
                                    >
                                        <Mail className="h-4 w-4" />
                                        Envoyer un email
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-semibold text-muted-foreground">Articles</h3>
                    </div>



                    {items.map((item, index) => {
                        const prixTTC = (item.prixUnitaire || 0) * (1 + (item.tva || 0) / 100);
                        const filteredProducts = products?.filter(p =>
                            p.nom.toLowerCase().includes((item.description || "").toLowerCase())
                        ).slice(0, 5) || [];

                        return (
                            <div key={item.id} className={cn("bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4 relative group transition-all", focusedItemId === item.id ? "z-20 ring-1 ring-primary/20" : "z-0")}>
                                <div className="absolute top-3 right-3 opacity-100 z-10">
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors bg-background/50 border border-transparent hover:border-border"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="pr-10 relative">
                                    <label className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 block">Description</label>
                                    <input
                                        placeholder="Nom de l'article ou service"
                                        value={item.description}
                                        onChange={(e) => {
                                            handleUpdateItem(item.id, "description", e.target.value);
                                            setFocusedItemId(item.id);
                                        }}
                                        onFocus={() => setFocusedItemId(item.id)}
                                        onBlur={() => setTimeout(() => setFocusedItemId(null), 400)}
                                        disabled={isReadOnly}
                                        className="w-full bg-transparent border-b border-border pb-2 text-sm font-medium focus:outline-none focus:border-primary placeholder:text-muted-foreground/50 disabled:opacity-50"
                                        autoComplete="off"
                                    />

                                    {/* Autocomplete Dropdown */}
                                    {focusedItemId === item.id && filteredProducts.length > 0 && (
                                        <div
                                            className="absolute top-full left-0 right-0 z-[100] mt-1 bg-white dark:bg-zinc-950 text-popover-foreground rounded-lg border border-border/50 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
                                        >
                                            {filteredProducts.map((product) => (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 text-sm hover:bg-muted/50 active:bg-muted flex items-center justify-between group/product border-b last:border-0 border-border/50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateItem(item.id, "description", product.nom);
                                                        handleUpdateItem(item.id, "prixUnitaire", product.prixUnitaire);
                                                        handleUpdateItem(item.id, "tva", product.tva || 20);
                                                        setFocusedItemId(null);
                                                    }}
                                                >
                                                    <span className="font-medium truncate pr-2">{product.nom}</span>
                                                    <span className="text-primary font-bold text-xs whitespace-nowrap bg-primary/10 px-2 py-1 rounded-full">
                                                        {product.prixUnitaire}€
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {/* Date Column - Full Width if enabled */}
                                    {showDateColumn && (
                                        <div className="bg-muted/10 p-2 rounded-lg border border-border/50">
                                            <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Date Prestation</label>
                                            <input
                                                type="date"
                                                value={item.date ? new Date(item.date).toISOString().split('T')[0] : ""}
                                                onChange={(e) => handleUpdateItem(item.id, "date", e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary disabled:opacity-50"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-12 gap-3 items-start">
                                        {/* Qty */}
                                        <div className="col-span-3 sm:col-span-2">
                                            <label className="text-[10px] text-muted-foreground uppercase font-semibold block text-center mb-1">Qté</label>
                                            <input
                                                type="number"
                                                value={item.quantite}
                                                onChange={(e) => handleUpdateItem(item.id, "quantite", e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full bg-muted/30 border border-transparent focus:bg-background focus:border-primary rounded-lg py-2 px-1 text-sm text-center transition-colors disabled:opacity-50"
                                            />
                                        </div>

                                        {/* Middle Block: Prices & Discount */}
                                        <div className="col-span-6 sm:col-span-7 space-y-2">
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-muted-foreground uppercase font-semibold block text-center mb-1">Prix HT</label>
                                                    <input
                                                        type="number"
                                                        value={item.prixUnitaire}
                                                        onChange={(e) => handleUpdateItem(item.id, "prixUnitaire", e.target.value)}
                                                        disabled={isReadOnly}
                                                        className="w-full bg-muted/30 border border-transparent focus:bg-background focus:border-primary rounded-lg py-2 px-1 text-sm text-center transition-colors disabled:opacity-50"
                                                    />
                                                </div>
                                                {showTTCColumn && (
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-muted-foreground uppercase font-semibold block text-center mb-1">TTC</label>
                                                        <input
                                                            type="number"
                                                            value={parseFloat(prixTTC.toFixed(2))}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                const rate = 1 + (item.tva || 0) / 100;
                                                                handleUpdateItem(item.id, "prixUnitaire", val / rate);
                                                            }}
                                                            disabled={isReadOnly}
                                                            className="w-full bg-muted/30 border border-transparent focus:bg-background focus:border-primary rounded-lg py-2 px-1 text-sm text-center transition-colors disabled:opacity-50"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {discountEnabled && (
                                                <div className="relative">
                                                    <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Remise ({discountType === 'pourcentage' ? '%' : '€'})</label>
                                                    <input
                                                        type="number"
                                                        value={item.remise}
                                                        onChange={(e) => handleUpdateItem(item.id, "remise", e.target.value)}
                                                        disabled={isReadOnly}
                                                        className="w-full bg-orange-500/5 border border-orange-500/20 focus:bg-background focus:border-orange-500 rounded-lg py-2 px-2 text-sm text-orange-700 placeholder:text-orange-300 transition-colors disabled:opacity-50"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Total */}
                                        <div className="col-span-3 text-right">
                                            <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Total</label>
                                            <p className="py-2 text-sm font-bold truncate text-primary">
                                                {(() => {
                                                    const montantAvantRemise = (item.quantite || 0) * (item.prixUnitaire || 0);
                                                    let remise = 0;
                                                    if (discountEnabled && item.remise) {
                                                        if (discountType === 'montant') remise = Number(item.remise);
                                                        else remise = montantAvantRemise * (Number(item.remise) / 100);
                                                    }
                                                    return Math.max(0, montantAvantRemise - remise).toFixed(2);
                                                })()}€
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Fields Toggle (Only TVA left if Discount acts as column) */}
                                <button
                                    onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                    className="w-full flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-primary transition-colors border-t border-dashed border-border/50 mt-2 pt-2"
                                >
                                    {expandedItemId === item.id ? "Masquer TVA" : `TVA (${item.tva || defaultTva}%)`}
                                    {expandedItemId === item.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>

                                {expandedItemId === item.id && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 animate-in slide-in-from-top-1">
                                        <div className="col-span-1">
                                            <label className="text-[10px] text-muted-foreground uppercase block mb-1">Taux TVA (%)</label>
                                            <input
                                                type="number"
                                                value={item.tva}
                                                onChange={(e) => handleUpdateItem(item.id, "tva", e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full bg-muted/30 rounded-lg px-2 py-2 text-sm disabled:opacity-50"
                                            />
                                        </div>
                                        <div className="col-span-1 flex items-end justify-end pb-2">
                                            <span className="text-[10px] text-muted-foreground italic">Appliqué au montant HT</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button
                        onClick={handleAddItem}
                        disabled={isReadOnly}
                        className="w-full py-3 rounded-xl border border-dashed border-border flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="h-4 w-4" />
                        Ajouter une ligne
                    </button>
                </div>

                {/* Notes & Conditions */}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Notes (visibles sur PDF)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Message ou détails supplémentaires..."
                            disabled={isReadOnly}
                            className="w-full bg-card border border-border rounded-xl p-3 text-sm min-h-[80px]"
                        />
                    </div>


                </div>

                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Remise Globale</label>
                        <div className="flex bg-muted rounded-lg p-1">
                            <button
                                onClick={() => setRemiseGlobaleType('pourcentage')}
                                className={cn("px-3 py-1 text-xs rounded-md transition-all", remiseGlobaleType === 'pourcentage' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                            >
                                %
                            </button>
                            <button
                                onClick={() => setRemiseGlobaleType('montant')}
                                className={cn("px-3 py-1 text-xs rounded-md transition-all", remiseGlobaleType === 'montant' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                            >
                                €
                            </button>
                        </div>
                    </div>
                    <input
                        type="number"
                        value={remiseGlobale}
                        onChange={(e) => setRemiseGlobale(parseFloat(e.target.value) || 0)}
                        className="w-full bg-muted/30 rounded-xl p-3 text-sm"
                        placeholder={remiseGlobaleType === 'pourcentage' ? "Ex: 10%" : "Ex: 50€"}
                    />

                    <div className="space-y-2 pt-2 border-t border-dashed">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Total HT</span>
                            <span>{calculateTotals().totalHT.toFixed(2)}€</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Total TVA</span>
                            <span>{calculateTotals().totalTVA.toFixed(2)}€</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar Total & Save */}
                <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border flex items-center gap-4 z-[60]">
                    <div className="flex-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Total TTC</p>
                        <p className="text-xl font-bold">{calculateTotals().totalTTC.toFixed(2)}€</p>
                    </div>
                    <button
                        onClick={handlePreview}
                        className="h-12 w-12 rounded-xl bg-secondary border border-border text-secondary-foreground flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                        title="Prévisualiser PDF"
                    >
                        <Eye className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                    >
                        <Save className="h-5 w-5" />
                        {isSubmitting ? "..." : "Enregistrer"}
                    </button>
                </div>
            </div>

            {/* Client Selector (Slide-in) */}
            {isSelectingClient && (
                // ... handled above by early return, but kept for structure if needed
                null
            )}
            <PDFPreviewModal
                isOpen={!!previewUrl}
                onClose={() => setPreviewUrl(null)}
                pdfUrl={previewUrl}
                invoiceNumber={currentDocNumber || "PREVIEW"}
            />
        </div>
    );
}
