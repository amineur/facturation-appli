"use client";

import { useData } from "@/components/data-provider";
import { cn } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, MapPin, FileText, Receipt, History, Edit2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface MobileClientDetailsProps {
    id: string;
}

export function MobileClientDetails({ id }: MobileClientDetailsProps) {
    const { clients, invoices, quotes } = useData();

    const client = clients.find(c => c.id === id);

    if (!client) {
        return (
            <div className="p-8 text-center pt-20">
                <p>Client introuvable</p>
                <Link href="/clients" className="text-primary underline mt-4 block">Retour liste</Link>
            </div>
        );
    }

    const clientInvoices = invoices.filter(i => i.clientId === id);
    const clientQuotes = quotes.filter(q => q.clientId === id);

    const totalSpent = clientInvoices
        .filter(i => i.statut === "Payée")
        .reduce((sum, i) => sum + i.totalTTC, 0);

    return (
        <div className="min-h-screen bg-muted/10 pb-24">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between">
                <Link href="/clients" className="p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <h1 className="font-bold text-lg truncate flex-1 text-center pr-8">{client.nom}</h1>
                <Link href={`/clients/${id}/edit`} className="p-2 -mr-2 rounded-full hover:bg-muted text-primary">
                    <Edit2 className="h-5 w-5" />
                </Link>
            </div>

            <div className="p-4 space-y-6">
                {/* Info Card */}
                <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm flex flex-col items-center text-center space-y-4">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                        {client.nom.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{client.nom}</h2>
                        {client.email && <p className="text-muted-foreground">{client.email}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-border/50">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Dépensé Total</p>
                            <p className="font-bold text-lg text-emerald-500">
                                {totalSpent.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Documents</p>
                            <p className="font-bold text-lg">{clientInvoices.length + clientQuotes.length}</p>
                        </div>
                    </div>
                </div>

                {/* Contact Actions */}
                <div className="flex gap-3">
                    {client.email && (
                        <a href={`mailto:${client.email}`} className="flex-1 py-3 bg-card border border-border rounded-xl flex items-center justify-center gap-2 font-medium active:scale-95 transition-transform">
                            <Mail className="h-5 w-5 text-blue-500" /> Email
                        </a>
                    )}
                    {client.telephone && (
                        <a href={`tel:${client.telephone}`} className="flex-1 py-3 bg-card border border-border rounded-xl flex items-center justify-center gap-2 font-medium active:scale-95 transition-transform">
                            <Phone className="h-5 w-5 text-emerald-500" /> Appeler
                        </a>
                    )}
                </div>

                {/* Recent Documents */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <History className="h-4 w-4" /> Historique
                    </h3>

                    {[...clientInvoices, ...clientQuotes]
                        .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())
                        .slice(0, 5)
                        .map(doc => (
                            <Link
                                key={doc.id}
                                href={(doc as any).type === "Facture" || (doc as any).numero.startsWith('FAC') ? `/factures/${doc.id}` : `/devis/${doc.id}`}
                                className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/50 active:bg-accent/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center",
                                        (doc as any).type === "Facture" || (doc as any).numero.startsWith('FAC') ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                                    )}>
                                        {(doc as any).type === "Facture" || (doc as any).numero.startsWith('FAC') ? <Receipt className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{doc.numero}</p>
                                        <p className="text-xs text-muted-foreground">{format(new Date(doc.dateEmission), "dd/MM/yyyy")}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-sm">
                                    {doc.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                </span>
                            </Link>
                        ))}
                </div>
            </div>
        </div>
    );
}
