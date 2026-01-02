"use client";

import { ArrowLeft, Database } from "lucide-react";
import Link from "next/link";

export function MobileDataManagement() {
    return (
        <div className="pb-32 bg-background min-h-screen">
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/settings" className="p-2 -ml-2 rounded-full hover:bg-muted">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="font-bold text-lg">Données</h1>
                </div>
            </div>

            <div className="p-8 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-slate-500/10 rounded-full flex items-center justify-center">
                    <Database className="h-8 w-8 text-slate-500" />
                </div>
                <h2 className="text-xl font-bold">Import / Export</h2>
                <p className="text-muted-foreground">
                    Pour des raisons de sécurité et de format de fichier, les opérations d'import/export massives sont réservées à la version Desktop.
                </p>
                <Link href="/settings" className="inline-block px-6 py-3 bg-secondary rounded-xl font-medium mt-4">
                    Retour
                </Link>
            </div>
        </div>
    );
}
