"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, FileText, Users, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/components/data-provider";
import Image from "next/image";

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useData();

    const isActive = (path: string) => {
        if (path === "/" && (pathname === "/" || pathname === "/dashboard")) return true;
        if (path !== "/" && pathname.startsWith(path)) return true;
        return false;
    };

    const navItems = [
        { label: "Tableau de bord", icon: Home, path: "/" },
        { label: "Documents", icon: FileText, path: "/factures" },
        { label: "Produits", icon: Package, path: "/produits" },
        { label: "Clients", icon: Users, path: "/clients" },
        { label: "Profil", icon: User, path: "/settings" },
    ];

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 glass border-x-0 border-b-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] z-50">
                <div className="flex items-center justify-around h-16">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            aria-label={item.label}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform touch-manipulation",
                                isActive(item.path) ? "text-[var(--primary)]" : "text-muted-foreground"
                            )}
                        >
                            {item.label === "Profil" ? (
                                <div className={cn("h-6 w-6 rounded-full overflow-hidden flex items-center justify-center border border-transparent transition-all", isActive(item.path) ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-muted text-muted-foreground")}>
                                    {user?.hasAvatar ? (
                                        <Image
                                            src={`/api/users/avatar/${user.id}?size=48&t=${Date.now()}`}
                                            alt="Profil"
                                            width={24}
                                            height={24}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-[10px] font-bold">{(user?.fullName || "U").charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                            ) : (
                                <item.icon className="h-6 w-6" />
                            )}
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* FAB - Floating Action Button (Only on Dashboard and Lists) */}
            {['/', '/dashboard', '/factures', '/devis', '/clients', '/produits'].includes(pathname) && (
                <div className="fixed bottom-20 right-4 z-50 pb-[env(safe-area-inset-bottom)]">
                    <button
                        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
                        onClick={() => router.push('/factures/new')}
                        aria-label="Créer un nouveau document"
                    >
                        {/* TODO: Add logic to open different Create Modals based on the current page? 
                             For now, it defaults to Facture New. 
                             If on Clients, maybe create Client?
                             For simplicity, keeping it as is or generic Plus.
                          */}
                        <span className="sr-only">Créer</span>
                        {/* We can use conditional logic here if we really want, but user didn't ask. */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                    </button>
                </div>
            )}
        </>
    );
}
