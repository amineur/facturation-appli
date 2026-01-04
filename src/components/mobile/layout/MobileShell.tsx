"use client";

import { BottomNav } from "./BottomNav";

interface MobileShellProps {
    children: React.ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
    return (
        <div className="flex flex-col min-h-screen pb-20 font-sans">
            {/* Header could go here */}
            <main className="flex-1 overflow-x-hidden">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}
