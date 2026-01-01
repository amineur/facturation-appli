"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Bell, Search, History, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { dataService } from "@/lib/data-service";
import { useData } from "@/components/data-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { HistoryDropdown } from "@/components/features/HistoryDropdown";

export function Header() {
    const router = useRouter();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const { user, isLoading, societe } = useData();

    const handleLogout = () => {
        dataService.logout();
    };

    // Optimistic fallback from localStorage
    const [cachedName, setCachedName] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem("glassy_user_name_cache");
            if (cached) setCachedName(cached);
        }
    }, []);

    const displayName = user?.fullName || cachedName || (isLoading ? "" : "Utilisateur");

    return (
        <header className="flex h-16 items-center justify-between border-b border-white/10 px-6 glass sticky top-0 z-10 w-full">
            <div className="flex w-full max-w-md items-center gap-4">
                {/* Demo Mode Banner */}
                {/* @ts-ignore */}
                {societe?.isTemplate && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        MODE DÉMO
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <HistoryDropdown />
                <ModeToggle />

                <div className="h-8 w-[1px] bg-white/10 mx-2" />

                <div className="relative">
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/20 overflow-hidden border border-white/10">
                            {user?.hasAvatar ? (
                                <Image
                                    src={`/api/users/avatar/${user.id}?size=60`}
                                    alt="User"
                                    width={60}
                                    height={60}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                displayName.charAt(0) || "U"
                            )}
                        </div>
                        <div className="hidden text-left md:block">
                            <p className="text-sm font-medium text-foreground">
                                {isLoading && !user ? (
                                    <span className="animate-pulse bg-white/10 h-4 w-24 block rounded"></span>
                                ) : (
                                    displayName
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">{user?.email || (isLoading ? <span className="animate-pulse bg-white/10 h-3 w-32 block rounded mt-1"></span> : "")}</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isUserMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                            <div className="absolute right-0 top-12 z-50 w-56 rounded-xl glass-dropdown p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-2xl border border-white/10">
                                <div className="px-2 py-1.5 text-sm font-semibold text-foreground border-b border-white/5 mb-1">
                                    Mon Compte
                                </div>
                                <button
                                    onClick={() => { setIsUserMenuOpen(false); router.push("/settings?view=PROFILE"); }}
                                    className="flex w-full items-center px-2 py-1.5 text-sm text-foreground hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <User className="mr-2 h-4 w-4" />
                                    Mon Profil
                                </button>
                                <button
                                    onClick={() => { setIsUserMenuOpen(false); router.push("/settings"); }}
                                    className="flex w-full items-center px-2 py-1.5 text-sm text-foreground hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <Settings className="mr-2 h-4 w-4" />
                                    Paramètres
                                </button>
                                <div className="h-[1px] bg-white/5 my-1" />
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center px-2 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Se déconnecter
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
