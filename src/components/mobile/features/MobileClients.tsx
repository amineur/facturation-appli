"use client";

import { useData } from "@/components/data-provider";
import { Search, Plus, Users, ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function MobileClients() {
    const { clients } = useData();
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);

    const filteredClients = clients
        .filter(client =>
            client.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => (b.totalPurchases || 0) - (a.totalPurchases || 0));

    return (
        <div className="flex flex-col h-screen pb-20 bg-background font-sans">
            {/* Header */}
            <div className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                        {showSearch ? (
                            <div className="relative animate-in fade-in zoom-in-95 duration-200">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    autoFocus
                                    placeholder="Rechercher un client..."
                                    className="w-full h-10 pl-9 pr-10 rounded-xl bg-muted/50 border-none text-sm focus:ring-1 focus:ring-primary"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <button
                                    onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <h1 className="text-xl font-bold tracking-tight">
                                    {clients.length} {clients.length > 1 ? "Clients" : "Client"}
                                </h1>
                                <button
                                    onClick={() => setShowSearch(true)}
                                    className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                                >
                                    <Search className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                        )}
                    </div>

                    {!showSearch && (
                        <Link href="/clients/new" className="h-10 w-10 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 flex items-center justify-center active:scale-90 transition-transform">
                            <Plus className="h-6 w-6" />
                        </Link>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredClients.map((client, index) => (
                    <Link
                        key={client.id}
                        href={`/clients/${client.id}`}
                        className="block group"
                    >
                        <div className="bg-card border border-border/50 p-4 rounded-2xl active:scale-[0.99] transition-all flex items-center gap-4 relative overflow-hidden">
                            {/* Glass Ranking Badge */}
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                                index === 0 ? "bg-orange-500/20 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]" :
                                    index === 1 ? "bg-orange-500/15 border-orange-500/20" :
                                        index === 2 ? "bg-orange-500/10 border-orange-500/15" :
                                            "bg-muted/50 border-border/50"
                            )}>
                                <span className={cn(
                                    "text-[10px] font-black mr-0.5",
                                    index < 3 ? "text-orange-500/50" : "text-muted-foreground/30"
                                )}>#</span>
                                <span className={cn(
                                    "text-sm font-bold",
                                    index < 3 ? "text-orange-500" : "text-muted-foreground"
                                )}>{index + 1}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h3 className="font-bold text-foreground truncate pr-2">{client.nom}</h3>
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground truncate">{client.email || "Pas d'email"}</p>
                                    <p className="text-sm font-bold text-foreground">
                                        {(client.totalPurchases || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}

                {filteredClients.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Aucun client trouvé</p>
                    </div>
                )}
            </div>
        </div>
    );
}
