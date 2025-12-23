"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Receipt,
    Users,
    Menu,
    X,
    Settings,
    Package,
    BarChart3,
    Trash2,
    Languages
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useData } from "@/components/data-provider";

const mainNavItems = [
    { name: "Tableau de Bord", href: "/", icon: LayoutDashboard }, // Changed name from Accueil
    { name: "Devis", href: "/devis", icon: FileText },
    { name: "Factures", href: "/factures", icon: Receipt },
];

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { societe, switchSociete, societes, isDirty, confirm } = useData();

    const handleNavigation = (href: string) => {
        if (pathname === href) {
            setIsMenuOpen(false);
            return;
        }

        const navigate = () => {
            setIsMenuOpen(false);
            router.push(href);
        };

        if (isDirty) {
            confirm({
                title: "Modifications non enregistrées",
                message: "Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter cette page ?",
                onConfirm: navigate
            });
        } else {
            navigate();
        }
    };

    return (
        <>
            {/* Extended Menu Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsMenuOpen(false)}>
                    <div
                        className="absolute bottom-[90px] left-4 right-4 bg-[#1a1a1a]/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-sm font-semibold text-foreground">Menu</span>
                            <div className="text-[10px] font-medium text-white/40 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                                v1.7
                            </div>
                        </div>

                        <div className="space-y-2">
                            <button onClick={() => handleNavigation("/clients")} className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
                                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                                    <Users className="h-5 w-5" />
                                </div>
                                <span className="font-medium text-sm text-foreground">Clients</span>
                            </button>

                            <button onClick={() => handleNavigation("/produits")} className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                                    <Package className="h-5 w-5" />
                                </div>
                                <span className="font-medium text-sm text-foreground">Produits & Services</span>
                            </button>

                            <button onClick={() => handleNavigation("/rapports")} className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <span className="font-medium text-sm text-foreground">Rapports & Statistiques</span>
                            </button>

                            <button onClick={() => handleNavigation("/corbeille")} className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
                                <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                                    <Trash2 className="h-5 w-5" />
                                </div>
                                <span className="font-medium text-sm text-foreground">Corbeille</span>
                            </button>

                            <button
                                onClick={() => handleNavigation("/settings")}
                                className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors group w-full text-left"
                            >
                                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
                                    <Languages className="h-5 w-5" />
                                </div>
                                <span className="font-medium text-foreground">Langue</span>
                            </button>

                            <div className="h-px bg-white/10 my-2" />

                            <button
                                onClick={() => {
                                    confirm({
                                        title: "Réinitialiser les données",
                                        message: "Attention : Cela va effacer toutes les données locales et restaurer l'état initial. Continuer ?",
                                        onConfirm: () => {
                                            localStorage.clear();
                                            window.location.reload();
                                        }
                                    });
                                }}
                                className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors group w-full text-left"
                            >
                                <div className="p-2 rounded-lg bg-red-500/10 text-red-500 group-hover:bg-red-500/20 transition-colors">
                                    <Trash2 className="h-5 w-5" />
                                </div>
                                <span className="font-medium text-red-500">Réinitialiser les données</span>
                            </button>

                            <button onClick={() => handleNavigation("/settings")} className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left">
                                <div className="p-2 rounded-xl bg-gray-500/10 text-gray-400">
                                    <Settings className="h-5 w-5" />
                                </div>
                                <span className="font-medium text-sm text-foreground">Paramètres</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Bar (Floating) */}
            <div className="fixed bottom-6 left-4 right-4 h-[70px] z-50 md:hidden">
                <div className="absolute inset-0 bg-[#121212]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl" />
                <div className="relative h-full flex items-center justify-around px-2">
                    {mainNavItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <button
                                key={item.name}
                                onClick={() => handleNavigation(item.href)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 w-16 h-full transition-all duration-200 active:scale-90",
                                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <div className={cn("p-1.5 rounded-xl transition-all duration-300", isActive && "bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]")}>
                                    <item.icon className={cn("h-5 w-5", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className={cn("text-[9px] font-medium tracking-wide transition-all", isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 hidden")}>
                                    {item.name}
                                </span>
                            </button>
                        );
                    })}

                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 w-16 h-full transition-all duration-200 active:scale-90",
                            isMenuOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <div className={cn("p-1.5 rounded-xl transition-all duration-300", isMenuOpen && "bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]")}>
                            {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.5} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
                        </div>
                        <span className={cn("text-[9px] font-medium tracking-wide transition-all", isMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 hidden")}>
                            Menu
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
}
