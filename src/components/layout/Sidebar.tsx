"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Package,
    FileText,
    Receipt,
    BarChart3,
    Settings,
    LogOut,
    Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/components/data-provider";
import { ChevronDown, Building2 } from "lucide-react"; // Removed UserCircle, unused
import { useState } from "react";

const navigation = [
    { name: "Tableau de bord", href: "/", icon: LayoutDashboard },
    { name: "Devis", href: "/devis", icon: FileText },
    { name: "Factures", href: "/factures", icon: Receipt },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Produits", href: "/produits", icon: Package },
    { name: "Rapports", href: "/rapports", icon: BarChart3 },
    { name: "Corbeille", href: "/corbeille", icon: Trash2 },
];

export function Sidebar() {
    const pathname = usePathname();
    const { societe, societes, switchSociete, user } = useData();
    const [isSocieteMenuOpen, setIsSocieteMenuOpen] = useState(false);

    return (
        <div className="flex h-full w-64 flex-col glass border-r border-white/20 dark:border-white/10 text-foreground">
            <div className="p-4 border-b border-white/20 dark:border-white/10">
                <div className="relative">
                    <button
                        onClick={() => setIsSocieteMenuOpen(!isSocieteMenuOpen)}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-9 w-9 min-w-[36px] rounded-md bg-white/5 backdrop-blur-sm flex items-center justify-center overflow-hidden p-1">
                                {societe?.logoUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={societe.logoUrl} alt={societe.nom} className="w-full h-full object-contain" />
                                ) : (
                                    <Building2 className="h-5 w-5 text-purple-400" />
                                )}
                            </div>
                            <div className="text-left overflow-hidden">
                                <p className="text-xs text-muted-foreground font-medium">Société</p>
                                <p className="text-sm font-bold text-foreground truncate">{societe?.nom || "Chargement..."}</p>
                            </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>

                    {isSocieteMenuOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 p-1 glass border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-xl bg-[#0a0a0a]/90">
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Changer de société</div>
                            {societes.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        switchSociete(s.id);
                                        setIsSocieteMenuOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors",
                                        s.id === societe.id
                                            ? "bg-purple-500/20 text-purple-400"
                                            : "hover:bg-white/10 text-foreground"
                                    )}
                                >
                                    <div className="h-2 w-2 rounded-full bg-current" style={{ opacity: s.id === societe.id ? 1 : 0.3 }} />
                                    {s.nom}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-3">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/10 text-primary shadow-lg shadow-purple-500/10 border border-white/20"
                                        : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", isActive ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground group-hover:text-foreground")} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-white/20 dark:border-white/10">

                <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                            {user?.fullName?.charAt(0) || "U"}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-foreground truncate">{user?.fullName || "Utilisateur"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-2 space-y-1">
                    <Link
                        href="/settings"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white/10 hover:text-purple-500 transition-colors"
                    >
                        <Settings className="h-5 w-5" />
                        Paramètres & Admin
                    </Link>
                    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white/10 hover:text-red-500 transition-colors">
                        <LogOut className="h-5 w-5" />
                        Déconnexion
                    </button>
                </div>
            </div>
        </div>
    );
}
