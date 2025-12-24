"use client";

import { useState } from "react";
import { Bell, Search, History, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { dataService } from "@/lib/data-service";
import { useData } from "@/components/data-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { HistoryDropdown } from "@/components/features/HistoryDropdown";
import { Skeleton } from "@/components/ui/skeleton";

export function Header() {
    const router = useRouter();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const { user, authChecked } = useData();

    // Removed diagnostic log

    const handleLogout = () => {
        dataService.logout();
    };

    return (
        <header className="flex h-16 items-center justify-between border-b border-white/10 px-6 glass sticky top-0 z-10 w-full">
            <div className="flex w-full max-w-md items-center gap-4">
                {/* Glassy Manage removed as requested */}
            </div>

            <div className="flex items-center gap-4">
                <HistoryDropdown />
                <ModeToggle />

                <div className="h-8 w-[1px] bg-white/10 mx-2" />

                <div className="relative">
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsUserMenuOpen(!isUserMenuOpen); }}
                        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-white/5 transition-colors cursor-pointer select-none"
                    >
                        {!authChecked ? (
                            // SKELETON STATE (While checking auth)
                            <>
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <div className="hidden text-left md:block">
                                    <Skeleton className="h-4 w-24 mb-1" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </>
                        ) : (
                            // LOADED STATE
                            <>
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/20 overflow-hidden border border-white/10">
                                    {user?.hasAvatar ? (
                                        <img
                                            src={`/api/users/avatar/${user.id}?t=${user.updatedAt ? new Date(user.updatedAt).getTime() : 0}`}
                                            alt="User"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        user?.fullName?.charAt(0) || "U"
                                    )}
                                </div>
                                <div className="hidden text-left md:block">
                                    <p className="text-sm font-medium text-foreground">{user?.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                                </div>
                            </>
                        )}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </div>

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
