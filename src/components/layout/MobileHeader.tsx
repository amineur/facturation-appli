"use client";

import { useState } from "react";
import Image from "next/image";
import { useData } from "@/components/data-provider";
import { ChevronDown, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function MobileHeader() {
    const { societe, switchSociete, societes } = useData();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            {/* Header with Switcher Trigger */}
            <div className="md:hidden p-4 border-b border-white/10 flex items-center justify-between bg-black/20 backdrop-blur-md relative z-30">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all"
                >
                    <span className="font-bold text-base bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent max-w-[150px] truncate">
                        {societe?.nom || "Chargement..."}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isMenuOpen && "rotate-180")} />
                </button>

                {societe?.logoUrl && (
                    <div className="h-8 w-8 rounded-md bg-white/5 backdrop-blur-sm flex items-center justify-center p-1">
                        <Image src={societe.logoUrl} alt={societe.nom} width={28} height={28} className="object-contain" priority unoptimized />
                    </div>
                )}
            </div>

            {/* Company Switcher Dropdown/Modal */}
            {isMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />

                    {/* Dropdown */}
                    <div className="md:hidden absolute top-[70px] left-0 right-0 z-50 px-4 pb-4 animate-in slide-in-from-top-4 duration-200">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-2 shadow-2xl">
                            {/* ... Content ... */}
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                                <span>Changer de société</span>
                                <button onClick={() => setIsMenuOpen(false)} className="p-1 hover:bg-white/10 rounded-md">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                            <div className="space-y-1 mt-1">
                                {societes.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            switchSociete(s.id);
                                            setIsMenuOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors border border-transparent active:scale-95 touch-manipulation",
                                            s.id === societe?.id
                                                ? "bg-purple-500/20 text-purple-400 border-purple-500/20"
                                                : "hover:bg-white/5 text-muted-foreground hover:text-white"
                                        )}
                                    >
                                        <div className="flex-1 text-left font-medium">{s.nom}</div>
                                        {s.id === societe?.id && <div className="h-2 w-2 rounded-full bg-current" />}
                                    </button>
                                ))}
                            </div>
                            <div className="border-t border-white/10 mt-2 pt-2">
                                <Link href="/settings" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 p-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors justify-center">
                                    <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Gérer / Créer une société</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
