"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { MOBILE_CONFIG } from "@/lib/mobile-config";
import { useEffect, useState } from "react";
// We will lazy load the Mobile App to split the bundle
import dynamic from "next/dynamic";
import { DashboardStateProvider } from "@/components/providers/dashboard-state-provider";
import { usePathname } from "next/navigation";
import { useData } from "@/components/data-provider";

const MobileApp = dynamic(() => import("@/components/mobile/MobileApp"), {
    ssr: false,
    loading: () => <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Chargement...</div>
});

interface MobileGuardProps {
    children: React.ReactNode;
}

const AUTH_ROUTES = [
    "/login",
    "/messagerie/login",
    "/register",
    "/signup",
    "/onboarding",
    "/pending-verification",
    "/forgot-password",
    "/reset-password"
];

export function MobileGuard({ children }: MobileGuardProps) {
    const isMobile = useIsMobile();
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const { user, isLoading } = useData();

    useEffect(() => {
        setMounted(true);
    }, []);

    // SSR Handling:
    // During SSR, we don't know the screen size. To avoid hydration mismatch,
    // we must render consistently.
    // Strategy: Render children (Desktop) by default on server. 
    // On client, once mounted and detected as mobile, we switch.
    // This effectively means "Desktop First" loading.

    if (!mounted || isMobile === undefined) {
        // Prevent Flash of Desktop Content (FOUC) on mobile.
        // Instead of defaulting to Desktop, we show a clean loader/blank state 
        // until we know for sure where we are.
        return <div className="min-h-screen bg-background flex items-center justify-center"></div>;
    }

    const { ENABLE_MOBILE_UI } = MOBILE_CONFIG;

    // Feature Flag OFF or Not Mobile -> Render Desktop
    if (!ENABLE_MOBILE_UI || isMobile === false) {
        return <>{children}</>;
    }

    // Bypass Mobile App for Auth Routes
    // This ensures we use the standard responsive login/onboarding pages
    // instead of the in-app shell which assumes a logged-in state.
    if (AUTH_ROUTES.some(route => pathname.startsWith(route))) {
        return <>{children}</>;
    }

    // AUTH CHECK:
    // If we are mobile but NOT logged in (and not loading), do NOT show the mobile shell.
    // Instead, show the children (which will handle the redirect to login or show the landing page).
    // This prevents the "Flash of Dashboard" before redirect.
    if (!user && !isLoading) {
        return <>{children}</>;
    }

    // Feature Flag ON + Mobile + User Logged In -> Render Mobile App
    return (
        <div data-mobile-app-root className="min-h-screen bg-background text-foreground">
            <DashboardStateProvider>
                <MobileApp />
            </DashboardStateProvider>
        </div>
    );
}
