"use client";

import { usePathname } from "next/navigation";
import { MobileShell } from "./layout/MobileShell";
import Link from "next/link";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";

// -- LAZY LOADED COMPONENTS (Code Splitting) --
// This drastically reduces the initial bundle size
const MobileDashboard = dynamic(() => import("./features/MobileDashboard").then(mod => mod.MobileDashboard));
const MobileDocuments = dynamic(() => import("./features/MobileDocuments").then(mod => mod.MobileDocuments));
const MobileClients = dynamic(() => import("./features/MobileClients").then(mod => mod.MobileClients));
const MobileDetails = dynamic(() => import("./features/MobileDetails").then(mod => mod.MobileDetails));
const MobileEditor = dynamic(() => import("./features/MobileInvoiceEditor").then(mod => mod.MobileEditor));
const MobileClientDetails = dynamic(() => import("./features/MobileClientDetails").then(mod => mod.MobileClientDetails));
const MobileClientEditor = dynamic(() => import("./features/MobileClientEditor").then(mod => mod.MobileClientEditor));
const MobileEmailComposer = dynamic(() => import("./features/MobileEmailComposer").then(mod => mod.MobileEmailComposer));
const MobileProducts = dynamic(() => import("./features/MobileProducts").then(mod => mod.MobileProducts));
const MobileSettings = dynamic(() => import("./features/MobileSettings").then(mod => mod.MobileSettings));
const MobileReports = dynamic(() => import("./features/MobileReports").then(mod => mod.MobileReports));
const MobileHistory = dynamic(() => import("./features/MobileHistory").then(mod => mod.MobileHistory));
const MobileCorbeille = dynamic(() => import("./features/MobileCorbeille").then(mod => mod.MobileCorbeille));
const MobileArchives = dynamic(() => import("./features/MobileArchives").then(mod => mod.MobileArchives));
const MobileIdentityEditor = dynamic(() => import("./features/MobileIdentityEditor").then(mod => mod.MobileIdentityEditor));
const MobileUsers = dynamic(() => import("./features/MobileUsers").then(mod => mod.MobileUsers));
const MobileEmailSettings = dynamic(() => import("./features/MobileEmailSettings").then(mod => mod.MobileEmailSettings));
const MobilePDFSettings = dynamic(() => import("./features/MobilePDFSettings").then(mod => mod.MobilePDFSettings));
const MobileDataManagement = dynamic(() => import("./features/MobileDataManagement").then(mod => mod.MobileDataManagement));
const MobileProfile = dynamic(() => import("./features/MobileProfile").then(mod => mod.MobileProfile));

export default function MobileApp() {
    const pathname = usePathname();

    // -- ROUTING MAPPER --
    let content = null;

    if (pathname === "/" || pathname === "/dashboard") {
        content = <MobileDashboard />;
    } else if (pathname.startsWith("/factures") || pathname.startsWith("/devis")) {
        const isInvoice = pathname.includes("factures");
        const parts = pathname.split('/');

        // Handle /new -> Editor
        if (parts.length > 2 && parts[2] === "new") {
            content = <MobileEditor type={isInvoice ? "FACTURE" : "DEVIS"} />;
        }
        // Handle /123/edit -> Editor
        else if (parts.length > 3 && parts[3] === "edit") {
            const id = parts[2];
            content = <MobileEditor id={id} type={isInvoice ? "FACTURE" : "DEVIS"} />;
        }
        // Handle /123/send -> Email Composer
        else if (parts.length > 3 && parts[3] === "send") {
            const id = parts[2];
            content = <MobileEmailComposer id={id} type={isInvoice ? "FACTURE" : "DEVIS"} />;
        }
        // Handle /123 -> Details
        else if (parts.length > 2) {
            const id = parts[2];
            content = <MobileDetails id={id} type={isInvoice ? "FACTURE" : "DEVIS"} />;
        }
        // Handle List
        else {
            content = <MobileDocuments initialTab={isInvoice ? "FACTURE" : "DEVIS"} />;
        }
    } else if (pathname.startsWith("/clients")) {
        const parts = pathname.split('/');
        // parts = ["", "clients", "new"] or ["", "clients", "123", "edit"]

        if (parts[2] === "new") {
            content = <MobileClientEditor />;
        }
        else if (parts.length > 3 && parts[3] === "edit") {
            const id = parts[2];
            content = <MobileClientEditor id={id} />;
        }
        else if (parts.length > 2 && parts[2]) {
            const id = parts[2];
            content = <MobileClientDetails id={id} />;
        }
        else {
            content = <MobileClients />;
        }
    } else if (pathname.startsWith("/products")) {
        content = <MobileProducts />;
    } else if (pathname.startsWith("/rapports")) {
        content = <MobileReports />;
    } else if (pathname.startsWith("/history")) {
        content = <MobileHistory />;
    } else if (pathname.startsWith("/corbeille")) {
        content = <MobileCorbeille />;
    } else if (pathname.startsWith("/archives")) {
        content = <MobileArchives />;
    } else if (pathname.startsWith("/settings")) {
        const parts = pathname.split('/');
        // pathname = /settings/identity -> parts = ["", "settings", "identity"]

        if (parts.length > 2) {
            const sub = parts[2];
            if (sub === 'identity') content = <MobileIdentityEditor />;
            else if (sub === 'users') content = <MobileUsers />;
            else if (sub === 'email') content = <MobileEmailSettings />;
            else if (sub === 'pdf') content = <MobilePDFSettings />;
            else if (sub === 'data') content = <MobileDataManagement />;
            else if (sub === 'profile') content = <MobileProfile />;
            else content = <MobileSettings />;
        } else {
            content = <MobileSettings />;
        }
    } else {
        // Fallback for unknown routes - instead of showing dashboard, show a specific error or redirect
        // For now, let's keep it safe by falling back to Dashboard but maybe logging
        console.warn("MobileApp: Unknown route", pathname);
        content = <MobileDashboard />;
    }

    return (
        <MobileShell>
            {content}
        </MobileShell>
    );
}
