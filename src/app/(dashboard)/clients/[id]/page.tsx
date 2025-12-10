"use client";

import { ClientEditor } from "@/components/features/ClientEditor";
import { useData } from "@/components/data-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { use, useEffect, useState } from "react";
import { Client } from "@/types";
import { ArrowLeft, Pencil, Mail, Phone, MapPin, Building, FileText, Globe } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function ClientDetailsPageWrapper(props: any) {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
            <ClientDetailsPage {...props} />
        </Suspense>
    );
}

function ClientDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { clients, invoices } = useData();
    const router = useRouter();
    const resolvedParams = use(params);
    const searchParams = useSearchParams();
    const [client, setClient] = useState<Client | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const found = clients.find(c => c.id === resolvedParams.id);
        if (found) {
            setClient(found);
        }
    }, [clients, resolvedParams.id]);

    useEffect(() => {
        setIsEditing(searchParams.get("edit") === "true");
    }, [searchParams]);

    if (!client) {
        return <div className="p-8 text-center text-muted-foreground">Chargement du client...</div>;
    }

    if (isEditing) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <button
                        onClick={() => setIsEditing(false)}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour à la fiche
                    </button>
                </div>
                <ClientEditor initialData={client} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Retour aux clients
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">{client.nom}</h2>
                        <p className="text-muted-foreground mt-1">Fiche client détaillée</p>
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 rounded-lg bg-blue-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 backdrop-blur-sm"
                    >
                        <Pencil className="h-4 w-4" />
                        Modifier
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Info */}
                <div className="glass-card rounded-xl p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Building className="h-5 w-5 text-blue-400" /> Informations Société
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground block">Référence</span>
                                <span className="text-foreground font-medium">{client.reference || "-"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Nom / Raison Sociale</span>
                                <span className="text-foreground font-medium">{client.nom}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground block">SIRET</span>
                                <span className="text-foreground font-medium">{client.siret || "-"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">TVA Intracommunautaire</span>
                                <span className="text-foreground font-medium">{client.tvaIntra || "-"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="glass-card rounded-xl p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <FileText className="h-5 w-5 text-purple-400" /> Coordonnées
                    </h3>
                    <div className="space-y-4 text-sm">
                        <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{client.email}</span>
                        </div>
                        {client.telephone && (
                            <div className="flex items-center gap-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-foreground">{client.telephone} (Fixe)</span>
                            </div>
                        )}
                        {client.mobile && (
                            <div className="flex items-center gap-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-foreground">{client.mobile} (Mobile)</span>
                            </div>
                        )}
                        <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="text-foreground">
                                {client.adresse}<br />
                                {client.adresse2 && <>{client.adresse2}<br /></>}
                                {client.codePostal} {client.ville}<br />
                                {client.pays}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Person */}
                {(client.prenomContact || client.nomContact) && (
                    <div className="glass-card rounded-xl p-6 space-y-6 md:col-span-2">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-green-400" /> Contact Principal
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground block">Titre</span>
                                <span className="text-foreground font-medium">{client.titreContact || "-"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Prénom</span>
                                <span className="text-foreground font-medium">{client.prenomContact || "-"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Nom</span>
                                <span className="text-foreground font-medium">{client.nomContact || "-"}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Invoices History */}
            <div className="glass-card rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <ReceiptIcon className="h-5 w-5 text-emerald-400" /> Historique des Factures
                    </h3>
                    <span className="text-sm text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        {invoices.filter(i => i.clientId === client.id).length} facture(s)
                    </span>
                    <span className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        Total: {invoices.filter(i => i.clientId === client.id).reduce((acc, curr) => acc + curr.totalTTC, 0).toFixed(2)} €
                    </span>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/5 bg-white/5">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white/5 text-muted-foreground font-medium">
                            <tr>
                                <th className="px-4 py-3">Numéro</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Montant TTC</th>
                                <th className="px-4 py-3 text-center">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {invoices.filter(i => i.clientId === client.id).length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Aucune facture pour ce client.</td>
                                </tr>
                            ) : (
                                invoices
                                    .filter(i => i.clientId === client.id)
                                    .map((invoice) => (
                                        <tr key={invoice.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => router.push(`/factures?id=${invoice.id}`)}>
                                            <td className="px-4 py-3 font-medium text-foreground group-hover:text-blue-400 transition-colors">{invoice.numero}</td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {invoice.dateEmission ? format(new Date(invoice.dateEmission), "dd.MM.yy") : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-right text-foreground font-medium">{invoice.totalTTC.toFixed(2)} €</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${invoice.statut === 'Payée' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                    invoice.statut === 'Retard' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                        invoice.statut === 'Brouillon' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' :
                                                            'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                    }`}>
                                                    {invoice.statut}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function ReceiptIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 17V7" />
        </svg>
    )
}

function UserIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
