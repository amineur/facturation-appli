"use client";

import { useData } from "@/components/data-provider";
import { generateNextInvoiceNumber, generateNextQuoteNumber } from "@/lib/invoice-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, User, UserPlus, Calendar, FileText, ChevronDown, ChevronUp, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createInvoice, updateInvoice } from "@/lib/actions/invoices";
import { createQuote, updateQuote } from "@/lib/actions/quotes";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/lib/pdf-generator";

interface MobileEditorProps {
    type: "FACTURE" | "DEVIS";
    id?: string;
}

export function MobileEditor({ type, id }: MobileEditorProps) {
    const router = useRouter();
    const { clients, societe, invoices, quotes, products } = useData();

    // Form State
    const searchParams = useSearchParams();
    const sourceId = searchParams.get("duplicate");

    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [items, setItems] = useState<any[]>([{ id: 1, description: "", quantite: 1, prixUnitaire: 0, tva: 20, remise: 0 }]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Fields
    const [dateEmission, setDateEmission] = useState(new Date().toISOString().split('T')[0]);
    // Default 30 days validity/due date
    const [dateEcheance, setDateEcheance] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [statut, setStatut] = useState<string>("Brouillon");
    const [notes, setNotes] = useState("");
    const [conditions, setConditions] = useState("");
    const [conditionsPaiement, setConditionsPaiement] = useState("À réception");
    const [datePaiement, setDatePaiement] = useState("");
    const [currentDocNumber, setCurrentDocNumber] = useState("");

    // UI States
    const [clientSearch, setClientSearch] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [isSelectingClient, setIsSelectingClient] = useState(false);
    const [isSelectingProduct, setIsSelectingProduct] = useState(false);
    const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false); // Dates & Status

    // Initial Load (Edit or Duplicate)
    useEffect(() => {
        const loadDoc = async () => {
            if (id) {
                // Edit Mode
                const doc = type === "FACTURE" ? invoices.find(i => i.id === id) : quotes.find(q => q.id === id);
                if (doc) {
                    setSelectedClientId(doc.clientId);
                    setItems((doc.items || []).map((i: any) => ({ ...i, id: Math.random() }))); // Regen IDs for local React keys

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
                    setConditions(doc.conditions || "");
                    try {
                        const conf = typeof (doc as any).config === 'string' ? JSON.parse((doc as any).config) : (doc as any).config || {};
                        if (conf.conditionsPaiement) setConditionsPaiement(conf.conditionsPaiement);
                    } catch (e) { }
                    setCurrentDocNumber(doc.numero);
                    if ((doc as any).datePaiement) {
                        try { setDatePaiement(new Date((doc as any).datePaiement).toISOString().split('T')[0]); } catch (e) { }
                    }
                }
            } else if (sourceId) {
                // Duplicate Mode
                const doc = type === "FACTURE" ? invoices.find(i => i.id === sourceId) : quotes.find(q => q.id === sourceId);
                if (doc) {
                    setSelectedClientId(doc.clientId);
                    setItems((doc.items || []).map((i: any) => ({ ...i, id: Math.random() })));
                    setNotes(doc.notes || "");
                    setConditions(doc.conditions || "");
                    // Keep default dates and status for duplicate
                }
            }
        };
        loadDoc();
    }, [id, sourceId, type, invoices, quotes]);

    const handleAddItem = () => {
        const newId = Date.now();
        setItems([...items, { id: newId, description: "", quantite: 1, prixUnitaire: 0, tva: 20, remise: 0 }]);
        setExpandedItemId(newId); // Auto expand new item
    };

    const handleRemoveItem = (id: number) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: number, field: string, value: any) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
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
            window.open(url, '_blank');
        }
    };

    const handleSave = async () => {
        if (!selectedClientId) {
            toast.error("Veuillez sélectionner un client");
            return;
        }

        setIsSubmitting(true);
        try {
            const mappedItems = items.map(i => {
                const q = Number(i.quantite);
                const p = Number(i.prixUnitaire);
                const r = Number(i.remise || 0);
                const t = Number(i.tva || 0);
                const ht = q * p * (1 - r / 100);
                return {
                    description: i.description || "Article",
                    quantite: q,
                    prixUnitaire: p,
                    tva: t,
                    remise: r,
                    totalLigne: ht // Approximate, backend usually recalcs
                };
            });

            const totalTTC = calculateTotal();
            const totalHT = items.reduce((sum, i) => sum + (Number(i.quantite) * Number(i.prixUnitaire) * (1 - Number(i.remise || 0) / 100)), 0);

            const docData: any = {
                dateEmission: new Date(dateEmission).toISOString(),
                clientId: selectedClientId,
                items: mappedItems,
                notes,
                conditions,
                statut,
                totalHT,
                totalTTC,
                config: JSON.stringify({ conditionsPaiement })
            };

            if (type === "FACTURE") {
                docData.dateEcheance = new Date(dateEcheance).toISOString();
            } else {
                docData.dateValidite = new Date(dateEcheance).toISOString();
            }

            if (type === "FACTURE" && statut === "Payée" && datePaiement) {
                docData.datePaiement = new Date(datePaiement).toISOString();
            }

            if (id) {
                // Update
                docData.id = id;
                docData.numero = currentDocNumber;

                if (type === "FACTURE") await updateInvoice(docData);
                else await updateQuote(docData);

                toast.success("Modifications enregistrées");
            } else {
                // Create
                const numero = currentDocNumber || (type === "FACTURE"
                    ? generateNextInvoiceNumber(invoices)
                    : generateNextQuoteNumber(quotes));
                docData.numero = numero;

                if (type === "FACTURE") await createInvoice(docData);
                else await createQuote(docData);

                toast.success(`${type === "FACTURE" ? "Facture" : "Devis"} créé`);
            }

            // Invalidate cache (useData usually handles this via realtime or optimistic, but let's be safe)
            router.push(type === "FACTURE" ? "/factures" : "/devis");

        } catch (error) {
            console.error(error);
            toast.error("Erreur d'enregistrement");
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <span className="font-bold text-sm">{id ? "Modifier" : "Nouvelle"} {type === "FACTURE" ? "Facture" : "Devis"}</span>
                    {currentDocNumber && <span className="text-[10px] text-muted-foreground">{currentDocNumber}</span>}
                </div>

                <div className="w-10" />
            </div>

            <div className="p-4 space-y-6">
                {/* Client Selector */}
                <button
                    onClick={() => setIsSelectingClient(true)}
                    className={cn(
                        "w-full p-4 rounded-2xl border flex items-center gap-4 transition-all text-left",
                        selectedClient
                            ? "bg-card border-border shadow-sm"
                            : "bg-muted/30 border-dashed border-muted-foreground/30 hover:bg-muted/50"
                    )}
                >
                    {selectedClient ? (
                        <>
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                                {selectedClient.nom[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold truncate">{selectedClient.nom}</p>
                                <p className="text-xs text-muted-foreground truncate">{selectedClient.email || "Sans email"}</p>
                            </div>
                            <div className="bg-primary/5 p-2 rounded-full text-primary">
                                <User className="h-4 w-4" />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                <UserPlus className="h-5 w-5" />
                            </div>
                            <span className="font-medium text-muted-foreground">Sélectionner un client</span>
                        </>
                    )}
                </button>

                {/* Dates & Status */}
                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center justify-between w-full"
                    >
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Dates & Statut
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
                                        className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">
                                        {type === "FACTURE" ? "Échéance" : "Validité"}
                                    </label>
                                    <input
                                        type="date"
                                        value={dateEcheance}
                                        onChange={e => setDateEcheance(e.target.value)}
                                        className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">Statut</label>
                                <select
                                    value={statut}
                                    onChange={e => setStatut(e.target.value)}
                                    className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
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
                            {type === "FACTURE" && statut === "Payée" && (
                                <div className="col-span-2 animate-in slide-in-from-top-2">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">Date de paiement</label>
                                    <input
                                        type="date"
                                        value={datePaiement}
                                        onChange={e => setDatePaiement(e.target.value)}
                                        className="w-full bg-muted/30 border border-border rounded-lg px-2 py-2 text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Items */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-semibold text-muted-foreground">Articles</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsSelectingProduct(true)}
                                className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium hover:bg-primary/20 transition-colors"
                            >
                                + Catalogue
                            </button>
                        </div>
                    </div>

                    {items.map((item, index) => (
                        <div key={item.id} className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-3 relative group">
                            <div className="absolute top-2 right-2 opacity-100">
                                <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            <input
                                placeholder="Description"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                className="w-[90%] bg-transparent border-b border-border/50 pb-2 text-sm font-medium focus:outline-none focus:border-primary"
                            />
                            <div className="flex gap-3">
                                <div className="w-16">
                                    <label className="text-[9px] text-muted-foreground uppercase block text-center">Qté</label>
                                    <input
                                        type="number"
                                        value={item.quantite}
                                        onChange={(e) => updateItem(item.id, "quantite", e.target.value)}
                                        className="w-full bg-muted/30 rounded-lg px-2 py-2 text-sm text-center"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] text-muted-foreground uppercase block text-center">Prix €</label>
                                    <input
                                        type="number"
                                        value={item.prixUnitaire}
                                        onChange={(e) => updateItem(item.id, "prixUnitaire", e.target.value)}
                                        className="w-full bg-muted/30 rounded-lg px-2 py-2 text-sm text-center"
                                    />
                                </div>
                                <div className="w-24 text-right">
                                    <label className="text-[9px] text-muted-foreground uppercase block">Total</label>
                                    <p className="py-2 text-sm font-bold">
                                        {(item.quantite * item.prixUnitaire * (1 - (item.remise || 0) / 100)).toFixed(2)}€
                                    </p>
                                </div>
                            </div>

                            {/* Extended Fields Toggle */}
                            <button
                                onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                className="text-xs text-primary flex items-center gap-1 mt-2"
                            >
                                {expandedItemId === item.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {expandedItemId === item.id ? "Masquer options" : "TVA & Remise"}
                            </button>

                            {expandedItemId === item.id && (
                                <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-border/50 animate-in slide-in-from-top-1">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground uppercase block mb-1">TVA (%)</label>
                                        <input
                                            type="number"
                                            value={item.tva}
                                            onChange={(e) => updateItem(item.id, "tva", e.target.value)}
                                            className="w-full bg-muted/30 rounded-lg px-2 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground uppercase block mb-1">Remise (%)</label>
                                        <input
                                            type="number"
                                            value={item.remise}
                                            onChange={(e) => updateItem(item.id, "remise", e.target.value)}
                                            className="w-full bg-muted/30 rounded-lg px-2 py-2 text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={handleAddItem}
                        className="w-full py-3 rounded-xl border border-dashed border-border flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
                            className="w-full bg-card border border-border rounded-xl p-3 text-sm min-h-[80px]"
                        />
                    </div>
                    {type === "FACTURE" && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Conditions de paiement</label>
                            <select
                                value={conditionsPaiement}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setConditionsPaiement(val);
                                    if (val !== "Personnalisé" && dateEmission) {
                                        const now = new Date(dateEmission);
                                        let days = 0;
                                        switch (val) {
                                            case "À réception": days = 0; break;
                                            case "15 jours": days = 15; break;
                                            case "30 jours": days = 30; break;
                                            case "30 jours fin du mois":
                                                const endOfMonth30 = new Date(now.getFullYear(), now.getMonth() + 2, 0); // Next month end
                                                setDateEcheance(endOfMonth30.toISOString().split('T')[0]);
                                                return;
                                            case "45 jours": days = 45; break;
                                            case "45 jours fin du mois":
                                                // Logic: +45 days then end of THAT month
                                                const d45 = new Date(now);
                                                d45.setDate(d45.getDate() + 45);
                                                const eom45 = new Date(d45.getFullYear(), d45.getMonth() + 1, 0);
                                                setDateEcheance(eom45.toISOString().split('T')[0]);
                                                return;
                                            case "60 jours": days = 60; break;
                                            case "60 jours fin du mois":
                                                const d60 = new Date(now);
                                                d60.setDate(d60.getDate() + 60);
                                                const eom60 = new Date(d60.getFullYear(), d60.getMonth() + 1, 0);
                                                setDateEcheance(eom60.toISOString().split('T')[0]);
                                                return;
                                        }
                                        const target = new Date(now);
                                        target.setDate(target.getDate() + days);
                                        setDateEcheance(target.toISOString().split('T')[0]);
                                    }
                                }}
                                className="w-full bg-card border border-border rounded-xl p-3 text-sm h-12"
                            >
                                <option value="À réception">À réception</option>
                                <option value="15 jours">15 jours</option>
                                <option value="30 jours">30 jours</option>
                                <option value="30 jours fin du mois">30 jours fin du mois</option>
                                <option value="45 jours">45 jours</option>
                                <option value="45 jours fin du mois">45 jours fin du mois</option>
                                <option value="60 jours">60 jours</option>
                                <option value="60 jours fin du mois">60 jours fin du mois</option>
                            </select>
                        </div>
                    )}

                </div>

                {/* Bottom Bar Total & Save */}
                <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border flex items-center gap-4 z-[60]">
                    <div className="flex-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Total TTC</p>
                        <p className="text-xl font-bold">{calculateTotal().toFixed(2)}€</p>
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
        </div>
    );
}
