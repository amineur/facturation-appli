"use client";

import { useData } from "@/components/data-provider";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { History, Search, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HistoryPage() {
    const { history } = useData();
    const [search, setSearch] = useState("");
    const router = useRouter();

    const filteredHistory = history.filter((entry: any) =>
        entry.description.toLowerCase().includes(search.toLowerCase()) ||
        entry.userName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => router.back()}
                        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                    </button>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <History className="h-8 w-8 text-blue-500" />
                        Historique d'activité
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Journal complet des actions utilisateurs sur la plateforme.
                    </p>
                </div>
            </div>

            <div className="glass-card rounded-xl p-6">
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher une action, un utilisateur..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 rounded-lg glass-input pl-10 pr-4 text-sm focus:ring-1 focus:ring-blue-500/50 transition-all"
                    />
                </div>

                <div className="rounded-lg border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-muted-foreground font-medium">
                            <tr>
                                <th className="p-4 w-48">Date</th>
                                <th className="p-4 w-48">Utilisateur</th>
                                <th className="p-4 w-32">Type</th>
                                <th className="p-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                        Aucune activité trouvée.
                                    </td>
                                </tr>
                            ) : (
                                filteredHistory.map((entry: any) => (
                                    <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 whitespace-nowrap text-muted-foreground">
                                            {format(new Date(entry.timestamp), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                                        </td>
                                        <td className="p-4 font-medium text-foreground">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-500 font-bold">
                                                    {entry.userName.charAt(0)}
                                                </div>
                                                {entry.userName}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                                ${entry.entityType === 'facture' ? 'bg-green-500/10 text-green-500' :
                                                    entry.entityType === 'devis' ? 'bg-indigo-500/10 text-indigo-500' :
                                                        entry.entityType === 'client' ? 'bg-amber-500/10 text-amber-500' :
                                                            'bg-gray-500/10 text-gray-400'}`}>
                                                {entry.entityType.charAt(0).toUpperCase() + entry.entityType.slice(1)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-foreground">
                                            {entry.description}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 text-xs text-muted-foreground text-center">
                    Affichage des {filteredHistory.length} dernières actions
                </div>
            </div>
        </div>
    );
}
