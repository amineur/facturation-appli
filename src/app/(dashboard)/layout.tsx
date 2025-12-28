import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { FaviconUpdater } from "@/components/features/FaviconUpdater";
import { MobileNav, MobileHeader } from "@/components/layout/MobileLazyLoaders";
import { Metadata } from "next";
import { getCurrentUser } from "@/app/actions";
import { redirect } from "next/navigation";

// Force dynamic rendering for all dashboard pages
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
    title: "Tableau de bord",
};

import { DashboardStateProvider } from "@/components/providers/dashboard-state-provider";

// ... existing imports

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // ... existing auth checks

    return (
        <div className="flex h-screen w-full overflow-hidden bg-transparent">
            <FaviconUpdater />
            {/* Desktop Sidebar */}
            <div className="hidden md:flex h-full">
                <Sidebar />
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <div className="hidden md:block">
                    <Header />
                </div>

                {/* Mobile Header (Dynamic) */}
                <MobileHeader />

                <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-[100px] md:pb-6 scrollbar-hide">
                    <div className="mx-auto max-w-7xl animate-in fade-in zoom-in duration-500">
                        <DashboardStateProvider>
                            {children}
                        </DashboardStateProvider>
                    </div>
                </main>
            </div>

            {/* Mobile Navigation */}
            <MobileNav />
        </div>
    );
}
