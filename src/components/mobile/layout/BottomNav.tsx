"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, FileText, Users, Menu, Plus, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
// We will implement BottomSheet later
// import { BottomSheet } from "./BottomSheet";

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isActive = (path: string) => {
        if (path === "/" && (pathname === "/" || pathname === "/dashboard")) return true;
        if (path !== "/" && pathname.startsWith(path)) return true;
        return false;
    };

    const navItems = [
        { label: "Tableau de bord", icon: Home, path: "/" },
        { label: "Documents", icon: FileText, path: "/factures" }, // Maps to MobileDocuments
        { label: "Clients", icon: Users, path: "/clients" },
        { label: "Produits", icon: Package, path: "/produits" },
        { label: "Menu", icon: Menu, path: "/settings" },
    ];

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] z-50">
                <div className="flex items-center justify-around h-16">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            aria-label={item.label}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform touch-manipulation",
                                isActive(item.path) ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <item.icon className="h-6 w-6" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* FAB - Floating Action Button (Only on Dashboard and Lists) */}
            {['/', '/dashboard', '/factures', '/devis', '/clients'].includes(pathname) && (
                <div className="fixed bottom-20 right-4 z-50 pb-[env(safe-area-inset-bottom)]">
                    <button
                        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
                        onClick={() => router.push('/factures/new')}
                        aria-label="Créer un nouveau document"
                    >
                        <Plus className="h-8 w-8" />
                    </button>
                </div>
            )}
        </>
    );
}
