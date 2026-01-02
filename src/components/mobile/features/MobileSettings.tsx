"use client";

import { useData } from "@/components/data-provider";
import { User, Building, Users, Mail, FileText, Database, LogOut, ChevronRight, Moon, Sun, BarChart3 } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { dataService } from "@/lib/data-service";

export function MobileSettings() {
    const { societe, user } = useData();
    const { theme, setTheme } = useTheme();
    const router = useRouter();

    const handleLogout = async () => {
        await dataService.logout();
        router.push("/login"); // Force navigation
    };

    const MenuItem = ({ icon: Icon, label, href, color, onClick }: { icon: any, label: string, href?: string, color: string, onClick?: () => void }) => {
        const Content = (
            <div className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", color)}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-medium">{label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
        );

        if (onClick) {
            return <button className="w-full text-left" onClick={onClick}>{Content}</button>;
        }
        return <Link href={href || "#"} className="block">{Content}</Link>;
    };

    return (
        <div className="p-4 space-y-6 pb-32">
            <div>
                <h1 className="text-2xl font-bold">Réglages</h1>
                <p className="text-sm text-muted-foreground">{societe?.nom || "Mon Entreprise"}</p>
            </div>

            {/* Profile Section */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase px-1">Mon Compte</p>
                <MenuItem
                    icon={User}
                    label="Mon Profil"
                    href="/settings/profile"
                    color="bg-blue-500"
                />
            </div>

            {/* Company Section */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase px-1">Entreprise</p>
                <MenuItem
                    icon={Building}
                    label="Identité Société"
                    href="/settings/identity"
                    color="bg-indigo-500"
                />
                <MenuItem
                    icon={Users}
                    label="Membres & Accès"
                    href="/settings/users"
                    color="bg-green-500"
                />
                <MenuItem
                    icon={Mail}
                    label="Email Stmp & Templates"
                    href="/settings/email"
                    color="bg-orange-500"
                />
                <MenuItem
                    icon={FileText}
                    label="Configuration PDF"
                    href="/settings/pdf"
                    color="bg-purple-500"
                />
                <MenuItem
                    icon={Database}
                    label="Données"
                    href="/settings/data"
                    color="bg-slate-500"
                />
            </div>

            {/* App Settings */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase px-1">Application</p>
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-full"
                >
                    <div className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-yellow-500">
                                {theme === 'dark' ? <Moon className="h-5 w-5 text-white" /> : <Sun className="h-5 w-5 text-white" />}
                            </div>
                            <span className="font-medium">Thème {theme === 'dark' ? 'Sombre' : 'Clair'}</span>
                        </div>
                    </div>
                </button>
            </div>

            {/* Logout */}
            <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-medium bg-red-500/10 rounded-xl mt-8 active:scale-[0.98] transition-all"
            >
                <LogOut className="h-5 w-5" />
                Se déconnecter
            </button>

            <p className="text-center text-xs text-muted-foreground pt-4">v1.2.0 • Gestion Facturation</p>
        </div>
    );
}
