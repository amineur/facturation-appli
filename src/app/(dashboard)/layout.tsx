import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { MobileHeader } from "@/components/layout/MobileHeader";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-transparent">
            {/* Desktop Sidebar */}
            <div className="hidden md:flex h-full">
                <Sidebar />
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header - Hidden on mobile or simplified? Keeping for now but maybe need adjustment */}
                <div className="hidden md:block">
                    <Header />
                </div>

                {/* Mobile Header (Dynamic) */}
                <MobileHeader />

                <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-[100px] md:pb-6 scrollbar-hide">
                    <div className="mx-auto max-w-7xl animate-in fade-in zoom-in duration-500">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Navigation */}
            <MobileNav />
        </div>
    );
}
