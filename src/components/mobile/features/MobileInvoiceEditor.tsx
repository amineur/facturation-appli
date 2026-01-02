"use client";

import { useData } from "@/components/data-provider";
import { generateNextInvoiceNumber } from "@/lib/invoice-utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, User, UserPlus, Calendar, FileText, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createInvoice, updateInvoice } from "@/lib/actions/invoices";
import { createQuote, updateQuote } from "@/lib/actions/quotes";
import { format } from "date-fns";

interface MobileEditorProps {
    type: "FACTURE" | "DEVIS";
    id?: string;
}

export function MobileEditor({ type, id }: MobileEditorProps) {
    const router = useRouter();
    const { clients, societe, invoices, quotes } = useData();

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
    const [currentDocNumber, setCurrentDocNumber] = useState("");

    // UI States
    const [clientSearch, setClientSearch] = useState("");
    const [isSelectingClient, setIsSelectingClient] = useState(false);
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
                    setCurrentDocNumber(doc.numero);
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
                totalTTC
            };

            if (type === "FACTURE") {
                docData.dateEcheance = new Date(dateEcheance).toISOString();
            } else {
                docData.dateValidite = new Date(dateEcheance).toISOString();
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
                const numero = currentDocNumber || await generateNextInvoiceNumber(type === "FACTURE" ? "facture" : "devis", type === "FACTURE" ? invoices : quotes);
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
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center shrink-0", selectedClient ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        <User className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        {selectedClient ? (
                            <>
                                <p className="font-bold">{selectedClient.nom}</p>
                                <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                            </>
                        ) : (
                            <p className="font-medium text-muted-foreground">Sélectionner un client</p>
                        )}
                    </div>
                    {!selectedClient && <Plus className="h-5 w-5 text-muted-foreground" />}
                </button>

                {/* Advanced Info Toggle */}
                <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center justify-between p-4 bg-muted/20"
                    >
                        <span className="text-sm font-semibold flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Dates & Statut
                        </span>
                        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showAdvanced && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase mb-1 block">Date Émission</label>
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
                        </div>
                    )}
                </div>

                {/* Items */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-semibold text-muted-foreground">Articles</h3>
                    </div>

                    {items.map((item, index) => (
                        <div key={item.id} className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-3 relative group">
                            <input
                                placeholder="Description"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                className="w-full bg-transparent border-b border-border/50 pb-2 text-sm font-medium focus:outline-none focus:border-primary"
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

                            <button onClick={() => handleRemoveItem(item.id)} className="absolute top-2 right-2 p-2 text-muted-foreground hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={handleAddItem}
                        className="w-full py-3 rounded-xl border border-dashed border-border/50 text-muted-foreground text-sm font-medium hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Ajouter une ligne
                    </button>
                </div>

                {/* Notes & Conditions */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block flex items-center gap-2">
                            <FileText className="h-3 w-3" /> Notes (visibles sur PDF)
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Notes pour le client..."
                            className="w-full bg-card border border-border rounded-xl p-3 text-sm min-h-[80px]"
                        />
                    </div>

                </div>

            </div>

            {/* Bottom Bar Total & Save */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border flex items-center gap-4 z-[60]">
                <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Total TTC</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-xl font-bold">{calculateTotal().toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                        <span className="text-xs text-muted-foreground">({items.length} articles)</span>
                    </div>
                </div>
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
    );
}
