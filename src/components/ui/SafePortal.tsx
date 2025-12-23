"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface SafePortalProps {
    children: React.ReactNode;
    containerId?: string;
}

/**
 * SafePortal: A wrapper for React createPortal that ensures:
 * 1. Rendering only on the client (prevents hydration mismatch)
 * 2. Target container exists (prevents crashes)
 * 3. Uses a stable root element (prevents navigation/removeChild conflicts)
 */
export function SafePortal({ children, containerId = "glass-portal-root" }: SafePortalProps) {
    const [mounted, setMounted] = useState(false);
    const [element, setElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setMounted(true);
        const el = document.getElementById(containerId);
        if (el) {
            setElement(el);
        } else {
            console.warn(`SafePortal: Container #${containerId} not found. Portals might not render.`);
        }
    }, [containerId]);

    // Only render when mounted on client and target element exists
    if (!mounted || !element) {
        return null;
    }

    return createPortal(children, element);
}
