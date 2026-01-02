"use client";

import { useData } from "@/components/data-provider";
import { cn } from "@/lib/utils";
import { Search, Mail, Phone, MapPin, ChevronRight, User, Plus, X, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function MobileClients() {
    const { clients } = useData();
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);

    const filteredClients = clients.filter(client =>
        client.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => a.nom.localeCompare(b.nom));

    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2">
                <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted shrink-0">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                {showSearch ? (
                    <div className="flex-1 relative animate-in fade-in zoom-in-95 duration-200">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            autoFocus
                            placeholder="Rechercher..."
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
                    <div className="flex-1 flex items-center justify-between">
                        <h1 className="text-xl font-bold">Clients ({clients.length})</h1>
                        <button
                            onClick={() => setShowSearch(true)}
                            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                        >
                            <Search className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                )}

                {!showSearch && (
                    <Link href="/clients/new" className="h-9 w-9 rounded-full bg-primary text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0">
                        <Plus className="h-5 w-5" />
                    </Link>
                )}
            </div>

            {/* Search */}


            {/* List */}
            <div className="flex-1 p-4 pb-32 space-y-3">
                {filteredClients.map((client) => (
                    <Link
                        key={client.id}
                        href={`/clients/${client.id}`}
                        className="block p-4 rounded-xl bg-card border border-border/50 shadow-sm active:bg-accent/50 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                                    <span className="font-bold text-sm">{client.nom.substring(0, 2).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm truncate">{client.nom}</h3>
                                    {client.email && (
                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                            <Mail className="h-3 w-3" /> {client.email}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                    </Link>
                ))}

                {filteredClients.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Aucun client trouvé</p>
                    </div>
                )}
            </div>
        </div>
    );
}
