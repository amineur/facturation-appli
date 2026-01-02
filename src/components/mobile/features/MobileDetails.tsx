"use client";

import { useData } from "@/components/data-provider";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Share2, Printer, Download, Edit2, Send, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PDFPreviewModal } from "@/components/ui/PDFPreviewModal";
import { useState } from "react";

interface MobileDetailsProps {
    id: string;
    type: "FACTURE" | "DEVIS";
}

export function MobileDetails({ id, type }: MobileDetailsProps) {
    const { invoices, quotes, clients, societe } = useData();
    const router = useRouter();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const doc = type === "FACTURE"
        ? invoices.find(i => i.id === id)
        : quotes.find(q => q.id === id);

    if (!doc) {
        return (
            <div className="p-8 text-center pt-20">
                <p>Document introuvable</p>
                <Link href="/" className="text-primary underline mt-4 block">Retour accueil</Link>
            </div>
        );
    }

    const client = clients.find(c => c.id === doc.clientId);
    const dateKey = type === "FACTURE" ? (doc as any).dateEmission : (doc as any).dateEmission;
    const handlePreview = async () => {
        if (!societe || !client) return;
        try {
            const url = await generateInvoicePDF(doc, societe, client, { returnBlob: true });
            if (url && typeof url === 'string') {
                setPreviewUrl(url);
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur génération PDF");
        }
    };

    const handleDownloadPDF = async () => {
        if (!societe) {
            toast.error("Société introuvable");
            return;
        }
        if (!client) {
            toast.error("Client introuvable");
            return;
        }

        try {
            toast.promise(
                async () => {
                    // Correct call signature: (document, societe, client)
                    const blobUrl = await generateInvoicePDF(doc, societe, client, { returnBlob: true });

                    if (blobUrl) {
                        const a = document.createElement("a");
                        a.href = blobUrl as unknown as string;
                        a.download = `${doc.numero}.pdf`;
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
        } catch (e) {
            console.error(e);
        }
    };

    const handleShare = async () => {
        // Simple Web Share API
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${type === "FACTURE" ? "Facture" : "Devis"} ${doc.numero}`,
                    text: `Voici ${type === "FACTURE" ? "la facture" : "le devis"} ${doc.numero} de ${societe?.nom}.`,
                    url: window.location.href // Or maybe a public link if available?
                });
            } catch (e) {
                // Share cancelled
            }
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(window.location.href);
            toast.success("Lien copié !");
        }
    };

    return (
        <div className="min-h-screen bg-muted/10 pb-40">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50 p-4 flex items-center justify-between">
                <Link href={type === "FACTURE" ? "/factures" : "/devis"} className="p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <span className="font-bold text-sm">{doc.numero}</span>
                <button onClick={handleShare} className="p-2 -mr-2 rounded-full hover:bg-muted text-primary">
                    <Share2 className="h-5 w-5" />
                </button>
            </div>

            <div className="p-4 space-y-6">
                {/* Status Card */}
                <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-1">Montant Total TTC</p>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
                        {doc.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                    </h1>
                    <div className="mt-4 flex justify-center">
                        <span className="px-3 py-1 rounded-full text-xs font-bold border bg-card capitalize">
                            {doc.statut}
                        </span>
                    </div>
                </div>

                {/* Client Card */}
                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Client</p>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {client?.nom.substring(0, 1)}
                        </div>
                        <div>
                            <p className="font-bold">{client?.nom || "Inconnu"}</p>
                            <p className="text-sm text-muted-foreground">{client?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Details Card */}
                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Date d'émission</span>
                        <span className="text-sm font-medium">{format(new Date(dateKey), "d MMMM yyyy", { locale: fr })}</span>
                    </div>
                    {type === "FACTURE" && (doc as any).dateEcheance && (
                        <div className="flex justify-between py-2 border-b border-border/50">
                            <span className="text-sm text-muted-foreground">Échéance</span>
                            <span className="text-sm font-medium">{format(new Date((doc as any).dateEcheance), "d MMMM yyyy", { locale: fr })}</span>
                        </div>
                    )}
                    {type === "DEVIS" && (doc as any).dateValidite && (
                        <div className="flex justify-between py-2 border-b border-border/50">
                            <span className="text-sm text-muted-foreground">Validité</span>
                            <span className="text-sm font-medium">{format(new Date((doc as any).dateValidite), "d MMMM yyyy", { locale: fr })}</span>
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Éléments</p>
                    {doc.items.map((item: any, index: number) => (
                        <div key={item.id || index} className="bg-card rounded-xl p-4 border border-border/50 shadow-sm space-y-2">
                            <div className="flex justify-between gap-4">
                                <p className="font-medium text-sm flex-1">{item.description || "Article sans nom"}</p>
                                <p className="font-bold text-sm">
                                    {item.totalLigne ? item.totalLigne.toFixed(2) : "0.00"}€
                                </p>
                            </div>
                            <div className="text-xs text-muted-foreground flex justify-between items-center">
                                <span>{item.quantite} × {item.prixUnitaire}€</span>
                                <div className="flex gap-2">
                                    {item.tva > 0 && <span className="bg-muted px-1.5 py-0.5 rounded">TVA {item.tva}%</span>}
                                    {item.remise > 0 && <span className="bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">-{item.remise}%</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Notes & Conditions */}
                {(doc.notes || doc.conditions) && (
                    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                        {doc.conditions && (
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Conditions de règlement</p>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{doc.conditions}</p>
                            </div>
                        )}
                        {doc.notes && (
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notes</p>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{doc.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Floating Actions */}
            <div className="fixed bottom-24 left-4 right-4 flex gap-2 z-40">
                <button
                    onClick={handlePreview}
                    className="p-3 bg-card border border-border text-foreground rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center"
                    aria-label="Preview"
                >
                    <Eye className="h-5 w-5" />
                </button>
                <button
                    onClick={handleDownloadPDF}
                    className="p-3 bg-card border border-border text-foreground rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center"
                    aria-label="PDF"
                >
                    <Download className="h-5 w-5" />
                </button>
                <Link
                    href={type === "FACTURE" ? `/factures/${id}?mode=edit` : `/devis/${id}?mode=edit`}
                    className="flex-1 bg-card border border-border text-foreground font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                    <Edit2 className="h-4 w-4" />
                    <span>Modifier</span>
                </Link>
                <Link
                    href={type === "FACTURE" ? `/factures/${id}/send` : `/devis/${id}/send`}
                    className="flex-[2] bg-primary text-primary-foreground font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                    <Send className="h-4 w-4" />
                    <span>Envoyer</span>
                </Link>
            </div>

            <PDFPreviewModal
                isOpen={!!previewUrl}
                onClose={() => setPreviewUrl(null)}
                pdfUrl={previewUrl}
                invoiceNumber={doc.numero}
            />
        </div>
    );
}
