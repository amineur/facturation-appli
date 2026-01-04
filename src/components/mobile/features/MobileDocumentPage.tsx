"use client";

import { useData } from "@/components/data-provider";
import { generateNextInvoiceNumber, generateNextQuoteNumber } from "@/lib/invoice-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { toast } from "sonner";
import {
    ArrowLeft, ChevronDown, Lock, Unlock, Settings, Trash2, Plus, Loader2, X, MoreHorizontal, FileText, Send, Save, Eye, Check, MessageSquare, Clock,
    User, UserPlus, Calendar, ChevronUp, Mail, Download, Receipt, Box, Briefcase, Edit2, Share2, Phone, MapPin
} from "lucide-react";
import { updateClient } from "@/lib/actions/clients";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createInvoice, updateInvoice, toggleInvoiceLock } from "@/lib/actions/invoices";
import { createQuote, updateQuote, toggleQuoteLock } from "@/lib/actions/quotes";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { safeFormat } from "@/lib/date-utils";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { getDraft, saveDraft } from "@/lib/draft-storage";
import { dataService } from "@/lib/data-service";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { PDFPreviewModal } from '@/components/ui/PDFPreviewModal';
import { EmailHistoryView } from '@/components/features/EmailHistoryView';

// Simple "Haptic" simulation helper
const haptic = () => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }
};

interface MobileDocumentPageProps {
    type: "FACTURE" | "DEVIS";
    id?: string;
    initialMode?: "view" | "edit";
}

export function MobileDocumentPage({ type, id, initialMode = "view" }: MobileDocumentPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { invoices, quotes, clients: globalClients, products, societe, isLoading } = useData();
    const currentDoc = id
        ? (type === "FACTURE" ? invoices.find(i => i.id === id) : quotes.find(q => q.id === id))
        : null;

    // Use optimistic clients
    const clients = globalClients;

    // -- STATE --
    const [isEditing, setIsEditing] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isSelectingClient, setIsSelectingClient] = useState(false);
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
    const [isClientEditorOpen, setIsClientEditorOpen] = useState(false);
    const [isSelectingProduct, setIsSelectingProduct] = useState(false);

    // Document Data State
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [items, setItems] = useState<any[]>([]);
    const [dateEmission, setDateEmission] = useState(new Date().toISOString().split('T')[0]);
    const [dateEcheance, setDateEcheance] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [statut, setStatut] = useState(type === "FACTURE" ? "Brouillon" : "Brouillon");

    // --- LOCK LOGIC: Aligned with Desktop ---
    const isHardLocked = type === "FACTURE"
        ? ["Envoyée", "Payée", "Annulée", "Archivée"].includes(statut)
        : ["Facturé", "Archivé"].includes(statut);

    const [isLocked, setIsLocked] = useState(false);

    // Effective ReadOnly State (Sync with Desktop logic)
    const isReadOnly = isHardLocked || isLocked;
    const isPaid = statut === "Payée";

    const [modifyingItemIndex, setModifyingItemIndex] = useState<number | null>(null);
    const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);

    const [notes, setNotes] = useState("");
    const [conditions, setConditions] = useState("");
    const [conditionsPaiement, setConditionsPaiement] = useState("À réception");
    const [currentDocNumber, setCurrentDocNumber] = useState("");
    const [remiseGlobale, setRemiseGlobale] = useState(0);
    const [remiseGlobaleType, setRemiseGlobaleType] = useState<'pourcentage' | 'montant'>('pourcentage');
    const [datePaiement, setDatePaiement] = useState("");
    const [numeroEnregistrement, setNumeroEnregistrement] = useState("");
    const [codeService, setCodeService] = useState("");

    // Config State
    const [showQuantiteColumn, setShowQuantiteColumn] = useState(true);
    const [showTvaColumn, setShowTvaColumn] = useState(true);
    const [showRemiseColumn, setShowRemiseColumn] = useState(false);
    const [showDateColumn, setShowDateColumn] = useState(false);
    const [showTTCColumn, setShowTTCColumn] = useState(false);
    const [showOptionalFields, setShowOptionalFields] = useState(false);
    const [discountEnabled, setDiscountEnabled] = useState(false);
    const [discountType, setDiscountType] = useState<'pourcentage' | 'montant'>('pourcentage');
    const [defaultTva, setDefaultTva] = useState(20);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [showCommunications, setShowCommunications] = useState(false);

    const [hasInitialized, setHasInitialized] = useState(false);
    const sourceId = searchParams.get("duplicate");

    // -- RESET INITIALIZATION ON ID CHANGE --
    useEffect(() => {
        setHasInitialized(false);
    }, [id, sourceId]);

    // -- INITIALIZATION --
    useEffect(() => {
        if (isLoading || hasInitialized) return;

        const doc = id
            ? (type === "FACTURE" ? invoices.find(i => i.id === id) : quotes.find(q => q.id === id))
            : (sourceId ? (type === "FACTURE" ? invoices.find(i => i.id === sourceId) : quotes.find(q => q.id === sourceId)) : null);

        if (doc) {
            // Priority: Draft > Server
            const draft = getDraft(id || 'new');
            const serverTime = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
            const useDraft = draft && draft.updatedAt > serverTime;

            const base = useDraft ? draft : doc;

            setSelectedClientId(base.clientId || "");
            // Ensure prices are formatted strings for inputs
            setItems((base.items || []).map((i: any) => ({
                ...i,
                id: i.id || Math.random().toString(36).substr(2, 9),
                prixUnitaire: i.prixUnitaire ? Number(i.prixUnitaire).toFixed(2) : "0.00"
            })));

            if (base.dateEmission) {
                try { setDateEmission(new Date(base.dateEmission).toISOString().split('T')[0]); } catch (e) { }
            }

            const echeance = type === "FACTURE" ? (base as any).dateEcheance : (base as any).dateValidite;
            if (echeance) {
                try { setDateEcheance(new Date(echeance).toISOString().split('T')[0]); } catch (e) { }
            }

            setIsLocked(!!doc.isLocked);
            setStatut(doc.statut || "Brouillon");
            setNotes(doc.notes || "");

            const conf = typeof (base as any).config === 'string'
                ? JSON.parse((base as any).config)
                : (base as any).config || {};

            setDiscountEnabled(conf.discountEnabled || false);
            // Check top-level first, then config (for sync support where column is missing)
            setRemiseGlobale((base as any).remiseGlobale || conf.remiseGlobale || 0);
            setRemiseGlobaleType((base as any).remiseGlobaleType || conf.remiseGlobaleType || 'pourcentage');
            setNumeroEnregistrement((base as any).numeroEnregistrement || "");
            setCodeService((base as any).codeService || "");

            if (!sourceId) {
                const nextNumber = type === "FACTURE" ? generateNextInvoiceNumber(invoices) : generateNextQuoteNumber(quotes);
                setCurrentDocNumber(base.numero || (doc && doc.numero) || nextNumber);
            } else {
                const nextNumber = type === "FACTURE" ? generateNextInvoiceNumber(invoices) : generateNextQuoteNumber(quotes);
                setCurrentDocNumber(nextNumber);
            }

            // Config

            setConditionsPaiement(conf.conditionsPaiement || "À réception");
            setShowTvaColumn(conf.showTvaColumn ?? true);
            setShowQuantiteColumn(conf.showQuantiteColumn ?? true);
            setShowRemiseColumn(conf.showRemiseColumn ?? conf.discountEnabled ?? false);
            setShowDateColumn(conf.showDateColumn ?? false);
            setShowTTCColumn(conf.showTTCColumn ?? false);
            setShowOptionalFields(conf.showOptionalFields ?? false);
            setDiscountEnabled(conf.discountEnabled ?? conf.showRemiseColumn ?? false);

            if ((base.statut === "Payée")) {
                setIsEditing(false);
            }

            setDiscountType(conf.discountType || 'pourcentage');
            setDefaultTva(conf.defaultTva ?? 20);

            // Strict Lock Priority: Server wins if it's locked
            const finalLockState = (!!doc.isLocked && !sourceId) || (base.isLocked ?? false);
            setIsLocked(finalLockState);

            // Visual Lockdown: Force read-only display if locked
            if (finalLockState || (base.statut && ["Envoyée", "Payée", "Annulée", "Archivée", "Facturé", "Archivé"].includes(base.statut))) {
                setIsEditing(false);
            }

            setHasInitialized(true);
        } else if (!id && !sourceId) {
            // New Document Defaults
            const globalConfig = dataService.getGlobalConfig();
            const defaults = type === "FACTURE" ? globalConfig.invoiceDefaults : globalConfig.quoteDefaults;

            setShowTvaColumn(true);
            setShowQuantiteColumn(true);
            setShowDateColumn(defaults?.showDate ?? globalConfig.showDateColumn ?? false);
            setShowTTCColumn(defaults?.showTtc ?? globalConfig.showTTCColumn ?? false);
            setShowOptionalFields(globalConfig.showOptionalFields ?? false);
            setDiscountEnabled(defaults?.showRemise ?? globalConfig.discountEnabled ?? false);
            setDiscountType(globalConfig.discountType || 'pourcentage');
            setDefaultTva(globalConfig.defaultTva ?? 20);

            const nextNumber = type === "FACTURE" ? generateNextInvoiceNumber(invoices) : generateNextQuoteNumber(quotes);
            setCurrentDocNumber(nextNumber);

            // Add initial empty item
            setItems([{ id: Math.random().toString(36).substr(2, 9), description: "", quantite: 1, prixUnitaire: 0, tva: defaultTva, remise: 0 }]);
            setHasInitialized(true);
        }
    }, [id, sourceId, type, invoices, quotes, isLoading, hasInitialized, defaultTva]);

    const draftRef = useRef<any>(null);

    // -- DRAFT SYNC: Unmount Save --
    useLayoutEffect(() => {
        return () => {
            if (!hasInitialized || !draftRef.current) return;
            console.log("[MOBILE] Unmounting - forcing save...", { items: draftRef.current.items?.length });
            saveDraft(id || 'new', { ...draftRef.current, updatedAt: Date.now() });
        };
    }, [id, hasInitialized]);


    // -- DRAFT SYNC: Auto-Save & Ref Update --
    useEffect(() => {
        if (!hasInitialized) return;

        const timer = setTimeout(() => {
            const payload = {
                clientId: selectedClientId,
                items: items.map(i => ({
                    ...i,
                    prixUnitaire: typeof i.prixUnitaire === 'string' ? parseFloat(i.prixUnitaire.replace(',', '.')) || 0 : Number(i.prixUnitaire) || 0,
                    quantite: Number(i.quantite) || 0,
                    remise: Number(i.remise) || 0,
                    tva: Number(i.tva) || 20
                })),
                remiseGlobale,
                remiseGlobaleType,
                conditionsPaiement,
                discountEnabled,
                discountType,
                defaultTva,
                showDateColumn,
                showTTCColumn,
                showRemiseColumn,
                showQuantiteColumn,
                showTvaColumn,
                showOptionalFields,
                isLocked,
                statut,
                updatedAt: Date.now()
            };
            console.log("[MOBILE] Saving draft (auto-save)...", { items: items.length });
            draftRef.current = payload;
            saveDraft(id || 'new', payload);
        }, 1000);

        return () => clearTimeout(timer);
    }, [items, selectedClientId, remiseGlobale, remiseGlobaleType, conditionsPaiement, discountEnabled, discountType, defaultTva, showDateColumn, showTTCColumn, showRemiseColumn, showQuantiteColumn, showTvaColumn, showOptionalFields, id, hasInitialized]);

    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

    // -- AUTO-CALCULATE DUE DATE --
    useEffect(() => {
        if (!dateEmission || !conditionsPaiement || !hasInitialized) return;

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

            if (dateEcheance !== formatted) {
                setDateEcheance(formatted);
            }
        } catch (e) {
            console.error("Date calc error", e);
        }
    }, [dateEmission, conditionsPaiement, hasInitialized, type]);

    // -- SYNC REMISE FLAGS --
    useEffect(() => {
        if (showRemiseColumn !== discountEnabled) {
            setDiscountEnabled(showRemiseColumn);
        }
    }, [showRemiseColumn]);

    useEffect(() => {
        if (discountEnabled !== showRemiseColumn) {
            setShowRemiseColumn(discountEnabled);
        }
    }, [discountEnabled]);


    // -- CALCULATIONS --
    const totals = (() => {
        let htAvantRemiseGlobale = 0;
        let remiseLignesTotal = 0;

        items.forEach(item => {
            const q = Number(item.quantite || 0);
            const p = Number(item.prixUnitaire || 0);
            const montantAvantRemise = q * p;
            let remiseLigne = 0;

            if (discountEnabled && item.remise && Number(item.remise) > 0) {
                remiseLigne = discountType === 'montant' ? Number(item.remise) : montantAvantRemise * (Number(item.remise) / 100);
            }
            remiseLignesTotal += remiseLigne;
            htAvantRemiseGlobale += Math.max(0, montantAvantRemise - remiseLigne);
        });

        let remiseGlobaleMontant = remiseGlobaleType === 'montant' ? remiseGlobale : htAvantRemiseGlobale * (remiseGlobale / 100);
        const globalDiscountRatio = htAvantRemiseGlobale > 0 ? Math.max(0, 1 - (remiseGlobaleMontant / htAvantRemiseGlobale)) : 1;
        const htNet = Math.max(0, htAvantRemiseGlobale - remiseGlobaleMontant);

        const tva = items.reduce((acc, item) => {
            const q = Number(item.quantite || 0);
            const p = Number(item.prixUnitaire || 0);
            const montantAvantRemise = q * p;
            let remiseLigne = 0;
            if (discountEnabled && item.remise && Number(item.remise) > 0) {
                remiseLigne = discountType === 'montant' ? Number(item.remise) : montantAvantRemise * (Number(item.remise) / 100);
            }
            const montantLigneNet = Math.max(0, montantAvantRemise - remiseLigne);
            const montantLigneFinal = montantLigneNet * globalDiscountRatio;
            return acc + (montantLigneFinal * (Number(item.tva || 0) / 100));
        }, 0);

        return {
            totalHT: htNet,
            totalTVA: tva,
            totalTTC: htNet + tva,
            remiseGlobaleMontant,
            htAvantRemiseGlobale
        };
    })();

    // -- ACTIONS --
    const handleSave = async (nextLockState?: boolean) => {
        if (!selectedClientId) {
            toast.error("Veuillez sélectionner un client");
            return;
        }

        setIsSubmitting(true);
        try {
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
                remiseGlobale,
                remiseGlobaleType,
                remiseGlobaleMontant: totals.remiseGlobaleMontant,
                config: {
                    conditionsPaiement,
                    showRemiseColumn,
                    showDateColumn,
                    showTTCColumn,
                    showOptionalFields,
                    discountEnabled,
                    discountType,
                    defaultTva,
                    // Persist Global Discount in Config since schema column might be missing
                    remiseGlobale,
                    remiseGlobaleType
                },
                isLocked: nextLockState !== undefined ? nextLockState : isLocked,
                societeId: societe?.id,
                type: type,
                numero: currentDocNumber,
                numeroEnregistrement,
                codeService
            };

            if (type === "FACTURE") {
                payload.dateEcheance = new Date(dateEcheance).toISOString();
                if (statut === "Payée" && datePaiement) {
                    payload.datePaiement = new Date(datePaiement).toISOString();
                }
            } else payload.dateValidite = new Date(dateEcheance).toISOString();

            let res;
            if (id) {
                payload.id = id;
                res = type === "FACTURE" ? await updateInvoice(payload) : await updateQuote(payload);
                if (nextLockState !== undefined) {
                    type === "FACTURE" ? await toggleInvoiceLock(id, nextLockState) : await toggleQuoteLock(id, nextLockState);
                    setIsLocked(nextLockState);
                } else {
                    // Always sync lock state on save
                    type === "FACTURE" ? await toggleInvoiceLock(id, isLocked) : await toggleQuoteLock(id, isLocked);
                }
                toast.success("Enregistré");
                setIsEditing(false); // Switch back to view mode after save
                // Success Feedback
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
            } else {
                res = type === "FACTURE" ? await createInvoice(payload) : await createQuote(payload);
                if (res?.id) {
                    toast.success("Créé avec succès");
                    router.push(type === "FACTURE" ? "/factures" : "/devis");
                }
            }
        } catch (e) {
            toast.error("Erreur d'enregistrement");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadPDF = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !societe) return;

        toast.promise(
            async () => {
                const doc: any = {
                    numero: currentDocNumber,
                    type,
                    dateEmission,
                    items: items.map(i => ({ ...i, totalLigne: Number(i.quantite) * Number(i.prixUnitaire) })),
                    totalTTC: totals.totalTTC,
                    totalHT: totals.totalHT,
                    totalTVA: totals.totalTVA,
                    notes,
                    conditions,
                    statut,
                    config: {
                        conditionsPaiement,
                        showRemiseColumn,
                        showDateColumn,
                        showTTCColumn,
                        showOptionalFields,
                        discountEnabled,
                        discountType,
                        defaultTva
                    }
                };
                if (type === "FACTURE") doc.dateEcheance = dateEcheance;
                else doc.dateValidite = dateEcheance;

                const blobUrl = await generateInvoicePDF(doc, societe, client, { returnBlob: true });
                if (blobUrl) {
                    const a = document.createElement("a");
                    a.href = blobUrl as any;
                    a.download = `${currentDocNumber}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            },
            {
                loading: "Génération du PDF...",
                success: "PDF téléchargé !",
                error: "Erreur lors de la génération"
            }
        );
    };

    const handlePreview = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !societe) return;
        const doc: any = {
            numero: currentDocNumber, type, dateEmission, items: items.map(i => ({ ...i, totalLigne: Number(i.quantite) * Number(i.prixUnitaire) })),
            totalTTC: totals.totalTTC, totalHT: totals.totalHT, totalTVA: totals.totalTVA, notes, conditions, statut, config: JSON.stringify({ conditionsPaiement })
        };
        const url = generateInvoicePDF(doc, societe, client, { returnBlob: true });
        if (url && typeof url === 'string') setPreviewUrl(url);
    };

    // -- RENDER HELPERS --
    const selectedClient = clients.find(c => c.id === selectedClientId);

    if (isLoading && !hasInitialized) {
        return (
            <div className="min-h-screen bg-background p-4 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }



    return (
        <div className="min-h-screen bg-transparent text-foreground font-sans">

            {/* Sticky Header */}
            <div className="sticky top-0 z-40 glass border-b border-border/10 px-[14px] py-[10px]">
                <div className="max-w-[460px] mx-auto flex items-center gap-[10px]">
                    <Link href={type === "FACTURE" ? "/factures" : "/devis"} className="w-[40px] h-[40px] rounded-[12px] glass-card grid place-items-center active:scale-95 transition-transform">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </Link>

                    <div className="flex-1 min-w-0">
                        <h1 className="m-0 text-[16px] font-bold leading-[1.1] truncate">
                            {type === "FACTURE" ? "Facture" : "Devis"}
                        </h1>
                        <p className="text-[13px] text-muted-foreground font-[600] truncate mt-[2px] mb-[2px]">
                            {currentDocNumber}
                        </p>
                        <div className="flex items-center gap-[8px] flex-wrap text-[#6E6A66] text-[12px]">
                            <span onClick={() => !isReadOnly && setIsStatusMenuOpen(!isStatusMenuOpen)} className="inline-flex items-center gap-[6px] px-[10px] py-[4px] rounded-full border border-border/20 bg-white/10 cursor-pointer hover:bg-muted/50 transition-colors">
                                <span className={cn("w-[8px] h-[8px] rounded-full", statut === "Payée" ? "bg-[var(--icon-invoice)]" : "bg-muted-foreground")}></span>
                                {statut}
                            </span>
                            {isStatusMenuOpen && (
                                <div className="absolute top-[60px] left-1/2 -translate-x-1/2 z-50 bg-white border border-[#E8E3DE] shadow-xl rounded-[18px] p-2 flex flex-col gap-1 w-[200px]">
                                    {["Brouillon", "Envoyée", "Payée", "Annulée"].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => { setStatut(s); setIsStatusMenuOpen(false); }}
                                            className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold", statut === s ? "bg-muted/10 text-foreground" : "hover:bg-muted/10 text-muted-foreground")}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-[8px]">
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="w-[40px] h-[40px] rounded-[12px] glass-card grid place-items-center active:scale-95 transition-transform"
                        >
                            <Clock className="h-5 w-5 text-muted-foreground" />
                        </button>

                        <button
                            onClick={async () => {
                                if (isHardLocked) {
                                    toast.error(`Un document ${statut.toLowerCase()} ne peut pas être déverrouillé`);
                                    return;
                                }
                                if (id && !isEditing) {
                                    // Direct toggle in view mode
                                    const newState = !isLocked;
                                    type === "FACTURE" ? await toggleInvoiceLock(id, newState) : await toggleQuoteLock(id, newState);
                                    setIsLocked(newState);
                                    toast.success(newState ? "Verrouillé" : "Déverrouillé");
                                } else {
                                    setIsLocked(!isLocked);
                                    toast.success(!isLocked ? "Verrouillé" : "Déverrouillé");
                                }
                            }}
                            className="w-[40px] h-[40px] rounded-[12px] glass-card grid place-items-center active:scale-95 transition-transform"
                        >
                            {isReadOnly ? <Lock className="h-5 w-5 text-orange-400" /> : <Unlock className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <button
                            onClick={() => !isReadOnly && setIsSettingsOpen(true)}
                            disabled={isReadOnly}
                            className={cn(
                                "w-[40px] h-[40px] rounded-[12px] glass-card grid place-items-center active:scale-95 transition-transform",
                                isReadOnly && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <Settings className={cn("h-5 w-5", isReadOnly ? "text-muted-foreground" : "text-foreground")} />
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-[460px] mx-auto px-[14px] pt-[14px] pb-[96px]">
                {/* Key Info */}
                <section className="grid grid-cols-2 gap-[12px]">
                    <div
                        className={cn("glass-card rounded-[18px] p-[14px] transition-all", !isReadOnly && "cursor-pointer active:scale-[99%]", isReadOnly && "opacity-80")}
                        onClick={() => {
                            if (isReadOnly) return;
                            selectedClient ? setIsClientDetailsOpen(true) : setIsSelectingClient(true);
                        }}
                    >
                        <div className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground mb-[10px]">Client</div>
                        {selectedClient ? (
                            <>
                                <p className="text-[14px] font-[650] m-0 text-foreground leading-tight line-clamp-2">{selectedClient.nom}</p>
                                <div className="mt-[6px] text-[13px] text-muted-foreground leading-[1.35]">
                                    <div className="mb-1">
                                        {selectedClient.adresse ? <span className="text-foreground font-[500] block leading-tight">{selectedClient.adresse}</span> : null}
                                        {selectedClient.ville || selectedClient.codePostal ? <span className="text-foreground font-[500] block leading-tight">{selectedClient.codePostal} {selectedClient.ville}</span> : null}
                                        {!selectedClient.adresse && !selectedClient.ville && <span className="text-muted-foreground italic">Adresse manquante</span>}
                                    </div>
                                    <span className="text-foreground break-words block text-[12px] leading-tight">
                                        {selectedClient.email}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <p className="text-[14px] font-[650] m-0 text-muted-foreground italic">Sélectionner...</p>
                        )}
                    </div>

                    <div className="glass-card rounded-[18px] p-[14px] flex flex-col justify-between">
                        <div className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground mb-[10px]">Dates</div>
                        <div className="flex justify-between gap-2 items-start">
                            <div className="flex flex-col relative group flex-1 min-w-0">
                                <span className="text-[13px] font-[600] text-muted-foreground mb-[2px]">Émission</span>
                                <div className="relative">
                                    {!isReadOnly && (
                                        <input
                                            type="date"
                                            value={dateEmission}
                                            onChange={e => { setDateEmission(e.target.value); setIsEditing(true); }}
                                            className="absolute inset-0 opacity-0 z-10 w-full h-full cursor-pointer"
                                        />
                                    )}
                                    <span className="text-[13px] font-[750] text-foreground whitespace-nowrap block min-h-[20px]">
                                        {safeFormat(dateEmission, 'dd/MM/yyyy')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col text-right relative group flex-1 min-w-0">
                                <span className="text-[13px] font-[600] text-muted-foreground mb-[2px]">Échéance</span>
                                <div className="relative">
                                    {!isReadOnly && (
                                        <input
                                            type="date"
                                            value={dateEcheance}
                                            onChange={e => { setDateEcheance(e.target.value); setIsEditing(true); }}
                                            className="absolute inset-0 opacity-0 z-10 w-full h-full cursor-pointer"
                                        />
                                    )}
                                    <span className={`text-[13px] font-[750] whitespace-nowrap block min-h-[20px] ${new Date(dateEcheance) < new Date() && statut !== 'Payée' ? 'text-destructive' : 'text-foreground'}`}>
                                        {safeFormat(dateEcheance, 'dd/MM/yyyy')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-[12px] border-t border-border/10 pt-[12px]">
                            <p className="text-[14px] font-[650] m-0 text-foreground">Conditions</p>
                            <div className="mt-[6px] text-[13px] text-muted-foreground relative">
                                {!isReadOnly && (
                                    <select
                                        value={conditionsPaiement}
                                        onChange={e => { setConditionsPaiement(e.target.value); setIsEditing(true); }}
                                        className="absolute inset-0 opacity-0 z-10 w-full h-full cursor-pointer appearance-none"
                                    >
                                        <option value="À réception">Paiement à réception</option>
                                        <option value="15 jours">15 jours</option>
                                        <option value="30 jours">30 jours</option>
                                        <option value="30 jours fin de mois">30 jours fin de mois</option>
                                        <option value="45 jours">45 jours</option>
                                        <option value="60 jours">60 jours</option>
                                    </select>
                                )}
                                <span className={cn("block min-h-[20px]", !conditionsPaiement && "opacity-50")}>
                                    {conditionsPaiement || "Définir les conditions"}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Items */}
                <section className="mt-[14px] glass-card rounded-[18px] overflow-hidden">
                    <div className="p-[14px] pb-[10px]">
                        <div className="text-muted-foreground flex items-baseline gap-1">
                            <span className="text-[12px] font-[800]">{items.length}</span>
                            <span className="text-[12px] uppercase tracking-[0.08em]">{items.length > 1 ? "Produits" : "Produit"}</span>
                        </div>
                    </div>

                    {items.map((item, index) => (
                        <ItemRow
                            key={item.id}
                            item={item}
                            index={index}
                            isEditing={isEditing}
                            isReadOnly={isReadOnly}
                            showDateColumn={showDateColumn}
                            showTvaColumn={showTvaColumn}
                            discountEnabled={discountEnabled}
                            products={products}
                            setItems={setItems}
                            items={items}
                            setFocusedItemIndex={setFocusedItemIndex}
                            focusedItemIndex={focusedItemIndex}
                        />
                    ))}

                    {isEditing && !isReadOnly && (
                        <div className="p-[14px]">
                            <button
                                onClick={() => {
                                    setItems([...items, { id: Math.random().toString(36).substr(2, 9), description: "", quantite: 1, prixUnitaire: "0.00", tva: defaultTva, remise: 0, date: new Date().toISOString().split('T')[0] }]);
                                }}
                                className="w-full rounded-[16px] border border-dashed border-border/50 bg-transparent p-[14px] font-[700] text-foreground cursor-pointer flex items-center justify-center gap-2 active:bg-muted/10 transition-colors"
                            >
                                <span>＋ Ajouter une ligne</span>
                            </button>
                        </div>
                    )}
                </section>

                {/* Summary */}
                <section className="mt-[14px] glass-card rounded-[18px] p-[14px]">
                    <div className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground mb-[10px]">Récapitulatif</div>
                    <div className="flex justify-between py-[10px] text-muted-foreground text-[14px]">
                        <span>Sous-total HT</span>
                        <span className="font-[650] text-foreground">{totals.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className="flex justify-between py-[10px] text-muted-foreground text-[14px]">
                        <span>TVA (20%)</span>
                        <span className="font-[650] text-foreground">{totals.totalTVA.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </div>
                    <div className="flex justify-between py-[10px] text-muted-foreground text-[14px] items-center">
                        <div className="flex flex-col gap-1">
                            <span>Remise globale</span>
                            {!isReadOnly && (
                                <div className="flex bg-muted/10 rounded-[8px] p-0.5 w-[140px] mt-1 shrink-0 ml-auto">
                                    <button
                                        onClick={() => setRemiseGlobaleType('pourcentage')}
                                        className={cn("px-2 py-0.5 text-[10px] font-bold rounded-[4px]", remiseGlobaleType === 'pourcentage' ? "bg-white shadow-sm text-black" : "text-muted-foreground")}
                                    >
                                        %
                                    </button>
                                    <button
                                        onClick={() => setRemiseGlobaleType('montant')}
                                        className={cn("px-2 py-0.5 text-[10px] font-bold rounded-[4px]", remiseGlobaleType === 'montant' ? "bg-white shadow-sm text-black" : "text-muted-foreground")}
                                    >
                                        €
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {isEditing && !isReadOnly ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={remiseGlobale}
                                        onChange={e => setRemiseGlobale(parseFloat(e.target.value) || 0)}
                                        className="w-[80px] glass-input border-none rounded-[6px] px-2 py-1 text-right font-bold text-foreground"
                                        placeholder="0"
                                    />
                                    <span className="text-[14px] font-[650] text-foreground">
                                        {remiseGlobaleType === 'pourcentage' ? '%' : '€'}
                                    </span>
                                </div>
                            ) : (
                                <span className="font-[650] text-foreground">
                                    {remiseGlobale} {remiseGlobaleType === 'pourcentage' ? '%' : '€'}
                                </span>
                            )}
                            <span className="text-[12px] text-red-500 font-medium">
                                - {(remiseGlobaleType === 'pourcentage' ? (totals.htAvantRemiseGlobale * (remiseGlobale / 100)) : remiseGlobale).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                            </span>
                        </div>
                    </div>
                    <div className="h-[1px] bg-border/10 my-[6px]"></div>
                    <div className="flex justify-between pt-[10px] text-[16px] font-[900] text-foreground">
                        <span>Total TTC</span>
                        <span>{totals.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                    </div>
                </section>

                {/* Details Accordions */}
                <section className="mt-[14px] space-y-[12px]">
                    <details className="glass-card rounded-[18px] overflow-hidden group">
                        <summary className="list-none cursor-pointer p-[14px] flex items-center justify-between gap-[10px] font-[750] text-foreground">
                            Notes internes
                            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-border/10 p-[14px] text-muted-foreground text-[14px]">
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Notes invisibles sur le PDF..."
                                className="w-full min-h-[92px] rounded-[14px] border border-border/20 p-[12px] resize-y outline-none bg-background/50 text-foreground focus:border-border transition-colors"
                            />
                        </div>
                    </details>
                </section>
            </main>

            {/* Bottom Actions */}
            {/* Bottom Actions Floating Bar (Mockup Style) */}
            <div className="fixed left-4 right-4 bottom-[100px] z-50">
                <div className="glass-card rounded-[24px] p-3 flex items-center justify-between gap-3">

                    {/* 1. Total Display */}
                    <div className="flex flex-col min-w-[80px]">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider mb-0.5">Total TTC</span>
                        <span className="text-[18px] font-[900] text-foreground leading-tight">
                            {totals.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                    </div>

                    {/* 2. Small Actions (Preview, Download, Save) */}
                    <div className="flex items-center gap-1 bg-muted/10 rounded-full p-1">
                        <button
                            onClick={handlePreview}
                            className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-white hover:shadow-sm transition-all active:scale-95"
                            title="Aperçu PDF"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handlePreview}
                            className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-white hover:shadow-sm transition-all active:scale-95"
                            title="Télécharger PDF"
                        >
                            <Download className="h-4 w-4" />
                        </button>

                        {/* Save (Enregistrer) - Included here */}
                        {!isReadOnly && (
                            <button
                                onClick={() => handleSave()}
                                disabled={isSubmitting}
                                className={cn(
                                    "w-8 h-8 rounded-full grid place-items-center transition-all active:scale-95 shadow-sm",
                                    isSaved ? "bg-green-500 text-white" : "bg-white text-muted-foreground hover:text-foreground"
                                )}
                                title="Enregistrer"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />)}
                            </button>
                        )}
                    </div>

                    {/* 3. Main Buttons */}
                    <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                        {/* Send */}
                        <Link
                            href={type === "FACTURE" ? `/factures/${id}/send` : `/devis/${id}/send`}
                            className="flex-1 h-[42px] px-3 rounded-full bg-primary text-primary-foreground font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 active:scale-95 transition-transform truncate no-underline"
                        >
                            <Send className="h-3.5 w-3.5" />
                            Envoyer
                        </Link>
                    </div>
                </div>
            </div>

            {/* Client Selection Modal */}
            {
                isSelectingClient && (
                    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5">
                        <div className="p-4 h-full flex flex-col max-w-[460px] mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-foreground">{selectedClientId ? 'Changer le client' : 'Sélectionner un client'}</h2>
                                <button onClick={() => setIsSelectingClient(false)} className="w-[40px] h-[40px] rounded-[12px] glass-card border border-border/10 grid place-items-center"><X className="h-5 w-5" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2">
                                {clients.map(client => (
                                    <button
                                        key={client.id}
                                        onClick={() => { setSelectedClientId(client.id); setIsSelectingClient(false); setIsEditing(true); }}
                                        className="w-full p-4 glass-card border border-border/10 rounded-[18px] text-left hover:bg-muted/10 transition-colors shadow-sm"
                                    >
                                        <p className="font-bold text-foreground">{client.nom}</p>
                                        <div className="text-sm text-[#6E6A66]">
                                            <p>{client.email}</p>
                                            <p>{client.ville}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Client Interaction Modal (Refined: No Avatar, Header Actions) */}
            {(isClientDetailsOpen || isClientEditorOpen) && selectedClient && (
                <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5">
                    <div className="p-4 h-full flex flex-col max-w-[460px] mx-auto">

                        {/* Header: Title + Edit Action */}
                        <div className="flex items-center justify-between mb-2 shrink-0 h-[44px]">
                            {isClientEditorOpen ? (
                                <button onClick={() => setIsClientEditorOpen(false)} className="text-[17px] text-foreground font-medium active:opacity-70">Annuler</button>
                            ) : (
                                <button
                                    onClick={() => { setIsClientDetailsOpen(false); setIsClientEditorOpen(false); }}
                                    className="w-[36px] h-[36px] rounded-full bg-muted text-muted-foreground grid place-items-center active:scale-95 transition-transform"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}

                            <h2 className="text-[17px] font-bold text-foreground">
                                {isClientEditorOpen ? "Modification" : "Fiche Client"}
                            </h2>

                            {isClientEditorOpen ? (
                                <div className="w-[60px]" /> /* Spacer to balance Cancel */
                            ) : (
                                <button
                                    onClick={() => setIsClientEditorOpen(true)}
                                    className="text-[17px] text-foreground font-bold active:opacity-70 transition-opacity"
                                >
                                    Modifier
                                </button>
                            )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto pb-6">
                            {!isClientEditorOpen ? (
                                /* VIEW MODE (Clean Layout) */
                                <div className="space-y-6 pt-2">

                                    {/* Identity & Swap Row */}
                                    <div className="flex items-start justify-between gap-4 px-2">
                                        <div>
                                            <h3 className="text-[28px] font-bold text-foreground leading-tight mb-1">{selectedClient.nom}</h3>
                                            <p className="text-[15px] text-[#8E8E93] font-medium">{selectedClient.email || "Email non renseigné"}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isReadOnly) {
                                                    toast.error("Le document est verrouillé. Impossible de changer de client.");
                                                    return;
                                                }
                                                setIsClientDetailsOpen(false);
                                                setIsSelectingClient(true);
                                            }}
                                            disabled={isReadOnly}
                                            className={cn(
                                                "h-[36px] px-4 rounded-full bg-muted text-foreground text-[14px] font-bold flex items-center gap-2 active:scale-95 transition-transform shrink-0 mt-1",
                                                isReadOnly && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <User className="h-4 w-4" />
                                            Changer
                                        </button>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="glass-card rounded-[18px] p-4 text-center shadow-sm">
                                            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Dépensé Total</p>
                                            <p className="text-[17px] font-bold text-[var(--icon-invoice)]">
                                                {invoices
                                                    .filter(i => i.clientId === selectedClient.id && i.statut === "Payée")
                                                    .reduce((sum, i) => sum + i.totalTTC, 0)
                                                    .toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                            </p>
                                        </div>
                                        <div className="glass-card rounded-[18px] p-4 text-center shadow-sm">
                                            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Documents</p>
                                            <p className="text-[17px] font-bold text-foreground">
                                                {invoices.filter(i => i.clientId === selectedClient.id).length + quotes.filter(q => q.clientId === selectedClient.id).length}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Details List */}
                                    <div className="glass-card rounded-[18px] overflow-hidden shadow-sm">
                                        <div className="divide-y divide-border/10 pl-4">
                                            <div className="flex items-center gap-3 py-3.5 pr-4">
                                                <div className="w-[30px] flex justify-center"><Phone className="h-5 w-5 text-[#8E8E93]" /></div>
                                                <div className="flex-1">
                                                    <p className="text-[11px] uppercase font-bold text-[#8E8E93] mb-0.5">Téléphone</p>
                                                    <p className="text-[16px] text-[#1E1E1E] font-medium">{selectedClient.telephone || "-"}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 py-3.5 pr-4">
                                                <div className="w-[30px] flex justify-center"><MapPin className="h-5 w-5 text-[#8E8E93]" /></div>
                                                <div className="flex-1">
                                                    <p className="text-[11px] uppercase font-bold text-[#8E8E93] mb-0.5">Adresse</p>
                                                    <p className="text-[16px] text-[#1E1E1E] font-medium leading-[1.3]">
                                                        {selectedClient.adresse ? (
                                                            <>
                                                                {selectedClient.adresse}<br />
                                                                {selectedClient.codePostal} {selectedClient.ville}
                                                            </>
                                                        ) : "-"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 py-3.5 pr-4">
                                                <div className="w-[30px] flex justify-center"><FileText className="h-5 w-5 text-[#8E8E93]" /></div>
                                                <div className="flex-1">
                                                    <p className="text-[11px] uppercase font-bold text-[#8E8E93] mb-0.5">SIRET</p>
                                                    <p className="text-[16px] text-[#1E1E1E] font-medium">{selectedClient.siret || "-"}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 py-3.5 pr-4">
                                                <div className="w-[30px] flex justify-center"><Briefcase className="h-5 w-5 text-[#8E8E93]" /></div>
                                                <div className="flex-1">
                                                    <p className="text-[11px] uppercase font-bold text-[#8E8E93] mb-0.5">TVA Intracom</p>
                                                    <p className="text-[16px] text-[#1E1E1E] font-medium">{selectedClient.tvaIntracom || "-"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* History Section */}
                                    <div>
                                        <h3 className="text-[13px] font-[800] text-[#6E6A66] uppercase tracking-wider mb-3 px-2">Historique récent ({invoices.filter(i => i.clientId === selectedClient.id).length + quotes.filter(q => q.clientId === selectedClient.id).length})</h3>
                                        <div className="space-y-2">
                                            {[...invoices.filter(i => i.clientId === selectedClient.id), ...quotes.filter(q => q.clientId === selectedClient.id)]
                                                .sort((a, b) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime())
                                                .slice(0, 3)
                                                .map(doc => (
                                                    <div key={doc.id} className="glass-card rounded-[16px] p-4 flex items-center justify-between shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center font-bold text-[10px]",
                                                                doc.id.includes('FAC') ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                                            )}>
                                                                {doc.id.includes('FAC') ? "FAC" : "DEV"}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-[14px] text-[#1E1E1E]">#{doc.id.slice(0, 8)}</p>
                                                                <p className="text-[12px] text-[#8E8E93]">{new Date(doc.createdAt || new Date()).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-[15px] text-[#1E1E1E]">{doc.totalTTC.toFixed(2)} €</span>
                                                    </div>
                                                ))}
                                            {[...invoices.filter(i => i.clientId === selectedClient.id), ...quotes.filter(q => q.clientId === selectedClient.id)].length === 0 && (
                                                <p className="text-center text-sm text-[#8E8E93] py-4 italic">Aucun document récent</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* EDIT MODE (Clean Form) */
                                <div className="pt-2 pb-20">
                                    <div className="bg-white border border-[#E8E3DE] rounded-[18px] overflow-hidden shadow-sm">
                                        <div className="divide-y divide-[#E8E3DE] pl-4">
                                            {['nom', 'email', 'telephone', 'adresse', 'codePostal', 'ville', 'pays', 'siret', 'tvaIntracom'].map((field) => (
                                                <div key={field} className="py-3 pr-4 flex items-center justify-between">
                                                    <label className="text-[15px] text-[#1E1E1E] w-[120px] shrink-0 capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</label>
                                                    <input
                                                        defaultValue={(selectedClient as any)[field]}
                                                        id={`client-edit-${field}`}
                                                        className="flex-1 text-right text-[15px] text-foreground placeholder:text-muted-foreground outline-none bg-transparent font-medium"
                                                        placeholder="Remplir"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        <button
                                            onClick={async () => {
                                                const getValue = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
                                                const data = {
                                                    nom: getValue('client-edit-nom'),
                                                    email: getValue('client-edit-email'),
                                                    telephone: getValue('client-edit-telephone'),
                                                    adresse: getValue('client-edit-adresse'),
                                                    codePostal: getValue('client-edit-codePostal'),
                                                    ville: getValue('client-edit-ville'),
                                                    pays: getValue('client-edit-pays'),
                                                    siret: getValue('client-edit-siret'),
                                                    tvaIntracom: getValue('client-edit-tvaIntracom'),
                                                };

                                                if (!data.nom) return toast.error("Le nom est requis");

                                                const toastId = toast.loading("Modification...");
                                                try {
                                                    await updateClient({ id: selectedClient.id, societeId: selectedClient.societeId, ...data });
                                                    toast.dismiss(toastId);
                                                    toast.success("Client modifié");
                                                    setIsClientEditorOpen(false);
                                                } catch (e) {
                                                    toast.dismiss(toastId);
                                                    toast.error("Erreur lors de la modification");
                                                }
                                            }}
                                            className="w-full h-[50px] rounded-[14px] bg-foreground text-background font-bold text-[17px] flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm"
                                        >
                                            Enregistrer
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {
                isSelectingProduct && (
                    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5">
                        <div className="p-4 h-full flex flex-col max-w-[460px] mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-foreground">Ajouter un produit</h2>
                                <button onClick={() => setIsSelectingProduct(false)} className="w-[40px] h-[40px] rounded-[12px] glass-card border border-border/10 grid place-items-center"><X className="h-5 w-5" /></button>
                            </div>
                            {/* Product List */}
                            <div className="flex-1 overflow-y-auto space-y-2 pb-20">
                                {products.map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => {
                                            const newItem = { ...product, id: Math.random().toString(36).substr(2, 9), quantite: 1, tva: defaultTva, remise: 0, prixUnitaire: Number(product.prixUnitaire).toFixed(2) };

                                            if (modifyingItemIndex !== null && items[modifyingItemIndex]) {
                                                // Update existing item
                                                const n = [...items];
                                                n[modifyingItemIndex] = { ...newItem, id: items[modifyingItemIndex].id }; // Keep original ID if needed, or replace? keeping ID is safer for React keys but swapping content.
                                                setItems(n);
                                            } else {
                                                // Append new
                                                setItems([...items, newItem]);
                                            }
                                            setIsSelectingProduct(false);
                                            setModifyingItemIndex(null);
                                            setIsEditing(true);
                                        }}
                                        className="w-full p-4 glass-card border border-border/10 rounded-[18px] text-left hover:bg-muted/10 transition-colors flex justify-between shadow-sm items-center"
                                    >
                                        <div>
                                            <p className="font-bold text-foreground">{product.nom}</p>
                                            <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                                        </div>
                                        <p className="font-bold text-foreground whitespace-nowrap ml-4">{Number(product.prixUnitaire).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
                                    </button>
                                ))}

                                <div className="pt-4">
                                    <button
                                        onClick={() => {
                                            // Adding empty line via modal (fallback)
                                            const newItem = { id: Math.random().toString(36).substr(2, 9), description: "", quantite: 1, prixUnitaire: "0.00", tva: defaultTva, remise: 0 };
                                            if (modifyingItemIndex !== null && items[modifyingItemIndex]) {
                                                // If user clicked search on a line but chose "Empty Line" (clearing it?)
                                                const n = [...items];
                                                n[modifyingItemIndex] = newItem;
                                                setItems(n);
                                            } else {
                                                setItems([...items, newItem]);
                                            }
                                            setIsSelectingProduct(false);
                                            setModifyingItemIndex(null);
                                            setIsEditing(true);
                                        }}
                                        className="w-full p-4 border border-dashed border-border/50 rounded-[18px] text-center text-foreground font-bold bg-transparent active:bg-muted/10 transition-colors"
                                    >
                                        + Ajouter une ligne vide
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Configuration Modal */}
            {
                isSettingsOpen && (
                    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5">
                        <div className="p-4 h-full flex flex-col max-w-[460px] mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Settings className="h-5 w-5" />
                                    Configuration
                                </h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="w-[40px] h-[40px] rounded-[12px] glass-card border border-border/10 grid place-items-center"><X className="h-5 w-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-6">
                                {/* Columns Configuration */}
                                <div className="glass-card rounded-[18px] p-5 shadow-sm space-y-6">

                                    {/* Section 1: Columns */}
                                    <div>
                                        <h3 className="text-xs font-[800] text-muted-foreground uppercase tracking-wider mb-4">Affichage des colonnes</h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[15px] font-medium text-foreground">Date de la prestation</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={showDateColumn} onChange={e => setShowDateColumn(e.target.checked)} className="sr-only peer" disabled={isReadOnly} />
                                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[14px] font-medium text-foreground">Colonnes HT / TTC</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={showTTCColumn} onChange={e => setShowTTCColumn(e.target.checked)} className="sr-only peer" disabled={isReadOnly} />
                                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[14px] font-medium text-foreground">Remises ligne</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={showRemiseColumn} onChange={e => setShowRemiseColumn(e.target.checked)} className="sr-only peer" disabled={isReadOnly} />
                                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full h-[1px] bg-border/10" />

                                    {/* Section 2: Discount Type */}
                                    <div>
                                        <h3 className="text-xs font-[800] text-muted-foreground uppercase tracking-wider mb-3">Type de remise (lignes)</h3>
                                        <div className="flex items-center gap-2 bg-muted/10 p-1 rounded-lg">
                                            <button
                                                onClick={() => setDiscountType('pourcentage')}
                                                className={cn("flex-1 py-2 text-[13px] font-bold rounded-md transition-all", discountType === 'pourcentage' ? "bg-white shadow-sm text-black" : "text-muted-foreground")}
                                            >
                                                Pourcentage (%)
                                            </button>
                                            <button
                                                onClick={() => setDiscountType('montant')}
                                                className={cn("flex-1 py-2 text-[13px] font-bold rounded-md transition-all", discountType === 'montant' ? "bg-white shadow-sm text-black" : "text-muted-foreground")}
                                            >
                                                Montant (€)
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full h-[1px] bg-border/10" />

                                    {/* Section 3: Default TVA */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[15px] font-bold text-foreground">TVA par défaut</span>
                                        <div className="relative w-[100px]">
                                            <input
                                                type="number"
                                                value={defaultTva}
                                                onChange={e => setDefaultTva(parseFloat(e.target.value) || 0)}
                                                className="w-full glass-input border-none rounded-[10px] px-3 py-2 text-right font-bold text-foreground outline-none focus:ring-1 focus:ring-border"
                                                placeholder="20"
                                            />
                                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-foreground font-bold pointer-events-none">%</span>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modals */}
            <PDFPreviewModal
                isOpen={!!previewUrl}
                onClose={() => setPreviewUrl(null)}
                pdfUrl={previewUrl}
                invoiceNumber={currentDocNumber}
            />

            {/* History Modal */}
            {
                isHistoryOpen && (
                    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5">
                        <div className="p-4 h-full flex flex-col max-w-[460px] mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Historique & Comms
                                </h2>
                                <button onClick={() => setIsHistoryOpen(false)} className="w-[40px] h-[40px] rounded-[12px] glass-card border border-border/10 grid place-items-center"><X className="h-5 w-5" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto glass-card rounded-[18px] p-4 shadow-sm">
                                <EmailHistoryView emails={currentDoc?.emails || []} />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// -- Sub-component for Item Row to handle motion values per item --
interface ItemRowProps {
    item: any;
    index: number;
    isEditing: boolean;
    isReadOnly: boolean;
    showDateColumn: boolean;
    showTvaColumn: boolean;
    discountEnabled: boolean;
    products: any[];
    setItems: (items: any[]) => void;
    items: any[];
    setFocusedItemIndex: (index: number | null) => void;
    focusedItemIndex: number | null;
}

function ItemRow({
    item, index, isEditing, isReadOnly, showDateColumn, showTvaColumn, discountEnabled,
    products, setItems, items, setFocusedItemIndex, focusedItemIndex
}: ItemRowProps) {
    const x = useMotionValue(0);
    const opacity = useTransform(x, [-100, -20], [1, 0]);

    return (
        <div className="relative border-b border-border/10 last:border-0 overflow-hidden">
            {/* Delete Action Background (Revealed on Swipe) */}
            {isEditing && !isReadOnly && (
                <motion.div
                    style={{ opacity }}
                    className="absolute inset-0 bg-red-500 flex justify-end items-center pr-6 z-0 rounded-[12px] my-[1px]"
                >
                    <Trash2 className="text-white h-6 w-6" />
                </motion.div>
            )}

            {/* Foreground Content */}
            <motion.div
                className={cn(
                    "p-[14px] bg-card border border-border/50 rounded-lg relative z-10",
                    !isEditing && !isReadOnly && "cursor-pointer"
                )}
                onClick={() => {
                    if (isReadOnly) return;
                }}
                style={{ x }}
                drag={isEditing && !isReadOnly ? "x" : false}
                dragConstraints={{ left: -1000, right: 0 }}
                dragElastic={{ left: 0.5, right: 0 }}
                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                onDragEnd={(e, info) => {
                    const threshold = -120; // Lower threshold (1/3 of screen approx)
                    const velocityThreshold = -500; // Flick detection

                    if (info.offset.x < threshold || info.velocity.x < velocityThreshold) {
                        // Haptic feedback
                        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                            window.navigator.vibrate(20);
                        }
                        setItems(items.filter((_, i) => i !== index));
                    }
                }}
                whileTap={{ cursor: "grabbing" }}
            >
                {/* Header: Description */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="relative flex-1">
                        <div className="flex items-center gap-2">
                            <div className="w-[8px] h-[8px] rounded-full bg-border/50"></div>
                            <input
                                value={item.description}
                                onFocus={() => setFocusedItemIndex(index)}
                                onBlur={() => setTimeout(() => setFocusedItemIndex(null), 200)}
                                onChange={e => {
                                    const n = [...items];
                                    n[index] = { ...n[index], description: e.target.value };
                                    setItems(n);
                                }}
                                placeholder="Nom du produit"
                                disabled={isReadOnly}
                                className={cn(
                                    "w-full bg-transparent border-none p-0 text-[16px] font-[650] text-foreground placeholder:text-muted-foreground focus:ring-0",
                                    !isEditing && "pointer-events-none"
                                )}
                                autoComplete="off"
                            />
                        </div>

                        {/* Autocomplete Dropdown */}
                        {focusedItemIndex === index && isEditing && !isReadOnly && (
                            <div className="absolute top-full left-0 w-full z-50 mt-1 glass-dropdown rounded-[12px] shadow-lg max-h-[200px] overflow-y-auto">
                                {products.filter(p =>
                                    p.nom.toLowerCase().includes(item.description.toLowerCase()) ||
                                    (p.description || "").toLowerCase().includes(item.description.toLowerCase()) ||
                                    item.description === ""
                                ).map(product => (
                                    <button
                                        key={product.id}
                                        className="w-full text-left p-3 hover:bg-muted/10 border-b border-border/10 last:border-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const n = [...items];
                                            n[index] = {
                                                ...n[index],
                                                description: product.description || product.nom,
                                                prixUnitaire: Number(product.prixUnitaire).toFixed(2),
                                            };
                                            setItems(n);
                                            setFocusedItemIndex(null);
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-foreground text-[13px]">{product.nom}</span>
                                            <span className="text-muted-foreground text-[12px]">{Number(product.prixUnitaire).toFixed(2)} €</span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground line-clamp-1">{product.description}</div>
                                    </button>
                                ))}
                                {products.filter(p =>
                                    p.nom.toLowerCase().includes(item.description.toLowerCase()) ||
                                    (p.description || "").toLowerCase().includes(item.description.toLowerCase()) ||
                                    item.description === ""
                                ).length === 0 && (
                                        <div className="p-3 text-[12px] text-muted-foreground italic text-center">Aucun produit trouvé</div>
                                    )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Unified Item Fields Stack */}
                <div className="flex flex-col pl-[16px]">
                    {showDateColumn && (
                        <div className="flex items-center justify-between py-2 border-b border-dashed border-border/10">
                            <label className="text-[12px] text-muted-foreground font-medium">Date</label>
                            <input
                                type="date"
                                value={item.date ? new Date(item.date).toISOString().split('T')[0] : ""}
                                onChange={e => {
                                    const n = [...items];
                                    n[index] = { ...n[index], date: e.target.value };
                                    setItems(n);
                                }}
                                disabled={isReadOnly}
                                className="glass-input border-none rounded-[6px] px-2 py-1 text-[16px] text-foreground font-medium text-right min-w-[100px]"
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between py-2 border-b border-dashed border-border/10">
                        <label className="text-[12px] text-muted-foreground font-medium whitespace-nowrap">Quantité</label>
                        {isEditing && !isReadOnly ? (
                            <input
                                type="number"
                                value={item.quantite}
                                onChange={e => {
                                    const n = [...items];
                                    n[index] = { ...n[index], quantite: e.target.value };
                                    setItems(n);
                                }}
                                className="w-16 flex-none glass-input rounded-[6px] px-2 py-1 text-center border-none focus:ring-0 font-bold text-[16px] text-foreground"
                            />
                        ) : (
                            <span className="font-bold text-foreground text-[13px]">{item.quantite}</span>
                        )}
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-dashed border-border/10">
                        <label className="text-[12px] text-muted-foreground font-medium whitespace-nowrap">Prix unitaire HT</label>
                        {isEditing && !isReadOnly ? (
                            <div className="flex items-center glass-input rounded-[6px] px-2 py-1 w-24 flex-none">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.prixUnitaire}
                                    onChange={e => {
                                        let val = e.target.value.replace(',', '.');
                                        if (val === '' || val === '.' || !isNaN(Number(val))) {
                                            const n = [...items];
                                            n[index] = { ...n[index], prixUnitaire: val };
                                            setItems(n);
                                        }
                                    }}
                                    placeholder="0.00"
                                    onBlur={(e) => {
                                        const val = parseFloat(e.target.value.replace(',', '.'));
                                        if (!isNaN(val)) {
                                            const n = [...items];
                                            n[index] = { ...n[index], prixUnitaire: val.toFixed(2) };
                                            setItems(n);
                                        }
                                    }}
                                    className="w-full bg-transparent border-none p-0 text-right focus:ring-0 font-bold text-[16px] text-foreground"
                                />
                                <span className="text-[12px] font-bold text-foreground ml-1">€</span>
                            </div>
                        ) : (
                            <span className="font-bold text-foreground text-[13px]">{Number(item.prixUnitaire).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                        )}
                    </div>

                    {showTvaColumn && (
                        <div className="flex items-center justify-between py-2 border-b border-dashed border-border/10">
                            <label className="text-[12px] text-muted-foreground font-medium whitespace-nowrap">TVA</label>
                            {isEditing && !isReadOnly ? (
                                <select
                                    value={item.tva || 20}
                                    onChange={e => {
                                        const n = [...items];
                                        n[index] = { ...n[index], tva: Number(e.target.value) };
                                        setItems(n);
                                    }}
                                    className="glass-input border-none rounded-[6px] px-2 py-1 text-[16px] text-foreground font-medium text-right w-[70px] flex-none"
                                >
                                    <option value={0}>0%</option>
                                    <option value={5.5}>5.5%</option>
                                    <option value={10}>10%</option>
                                    <option value={20}>20%</option>
                                </select>
                            ) : (
                                <span className="font-bold text-foreground text-[13px]">{item.tva || 20}%</span>
                            )}
                        </div>
                    )}

                    {discountEnabled && (
                        <div className="flex items-center justify-between py-2 border-b border-dashed border-border/10">
                            <label className="text-[12px] text-muted-foreground font-medium">Remise</label>
                            <div className="flex items-center gap-1 glass-input rounded-[6px] px-1 py-0.5">
                                <input
                                    type="number"
                                    value={item.remise || 0}
                                    onChange={e => {
                                        const n = [...items];
                                        n[index] = { ...n[index], remise: Number(e.target.value) };
                                        setItems(n);
                                    }}
                                    disabled={isReadOnly}
                                    className="bg-transparent border-none p-0 text-[16px] text-foreground font-bold w-[40px] text-right"
                                />
                                <button
                                    onClick={() => {
                                        if (isReadOnly) return;
                                        const n = [...items];
                                        n[index] = { ...n[index], remiseType: item.remiseType === 'montant' ? 'pourcentage' : 'montant' };
                                        setItems(n);
                                    }}
                                    className="text-[10px] font-bold text-muted-foreground uppercase px-1 hover:text-foreground"
                                >
                                    {item.remiseType === 'montant' ? '€' : '%'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-3 text-[14px] font-[800] text-foreground">
                        <span>{(Number(item.quantite) * Number(item.prixUnitaire)).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

