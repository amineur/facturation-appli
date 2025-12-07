"use client";

import { Search, Bell, ChevronDown } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export function Header() {
    return (
        <header className="flex h-16 items-center justify-between border-b border-white/10 px-6 glass sticky top-0 z-10 w-full">
            <div className="flex w-full max-w-md items-center gap-4">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="h-9 w-full rounded-full glass-input pl-9 pr-4 text-sm transition-all focus:w-[105%]"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <ModeToggle />
                <button className="relative rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0f172a]" />
                </button>

                <div className="h-8 w-[1px] bg-white/10 mx-2" />

                <button className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-white/5 transition-colors">
                    <img
                        src="https://placehold.co/100x100"
                        alt="User"
                        className="h-8 w-8 rounded-full border border-white/20"
                    />
                    <div className="hidden text-left md:block">
                        <p className="text-sm font-medium text-white">Admin User</p>
                        <p className="text-xs text-gray-400">admin@company.com</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
            </div>
        </header>
    );
}
