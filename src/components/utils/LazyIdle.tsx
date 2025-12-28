"use client";

import { useState, useEffect } from "react";

export function LazyIdle({ children, placeholder }: { children: React.ReactNode, placeholder?: React.ReactNode }) {
    const [canRender, setCanRender] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            const id = (window as any).requestIdleCallback(() => {
                setCanRender(true);
            });
            return () => (window as any).cancelIdleCallback(id);
        } else {
            // Fallback for browsers without requestIdleCallback or SSR
            const id = setTimeout(() => setCanRender(true), 1);
            return () => clearTimeout(id);
        }
    }, []);

    if (!canRender) return <>{placeholder}</>;

    return <>{children}</>;
}
