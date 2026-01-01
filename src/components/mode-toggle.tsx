"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ModeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const toggleTheme = () => {
        if (theme === 'light') setTheme('dark');
        else if (theme === 'dark') setTheme('premium');
        else setTheme('light');
    };

    if (!mounted) {
        return (
            <button className="relative rounded-full p-2 text-gray-400 opacity-50 cursor-wait">
                <Sun className="h-5 w-5" />
            </button>
        );
    }

    return (
        <button
            onClick={toggleTheme}
            className="relative rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-foreground transition-colors"
            title={theme === 'premium' ? "Mode Premium" : theme === 'dark' ? "Mode Sombre" : "Mode Clair"}
        >
            {/* Sun for Light Mode */}
            <Sun className={`h-5 w-5 transition-all ${theme === 'light' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`} />

            {/* Moon for Dark Mode */}
            <Moon className={`h-5 w-5 transition-all ${theme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`} />

            {/* Diamond/Sparkle for Premium Mode */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-5 w-5 transition-all ${theme === 'premium' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute text-primary'}`}
            >
                <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0l-7.59 7.59Z" />
            </svg>
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}
