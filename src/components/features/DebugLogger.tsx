"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * DebugLogger: Captures user actions and logs them to the console.
 * In case of a crash (captured by window.onerror), it dumps the history.
 */
export function DebugLogger() {
    const pathname = usePathname();
    const history = useRef<{ type: string; data: any; timestamp: number }[]>([]);
    const MAX_HISTORY = 50;

    const logEvent = (type: string, data: any) => {
        const event = { type, data, timestamp: Date.now() };
        history.current.push(event);
        if (history.current.length > MAX_HISTORY) {
            history.current.shift();
        }
        // console.log(`[DEBUG] ${type}:`, data);
    };

    useEffect(() => {
        logEvent("ROUTE_CHANGE", { pathname });
    }, [pathname]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            logEvent("CLICK", {
                tag: target.tagName,
                id: target.id,
                className: target.className,
                text: target.innerText?.substring(0, 20),
                path: getElementPath(target),
            });
        };

        const handleError = (event: ErrorEvent) => {
            if (event.message.includes("removeChild") || event.message.includes("null")) {
                console.error("!!! CRASH DETECTED !!!");
                console.error("Action History (last 50 steps):", history.current);
                console.error("Error Detail:", event.error);
            }
        };

        window.addEventListener("click", handleClick, true);
        window.addEventListener("error", handleError);

        return () => {
            window.removeEventListener("click", handleClick, true);
            window.removeEventListener("error", handleError);
        };
    }, []);

    return null;
}

function getElementPath(el: HTMLElement | null): string {
    if (!el) return "";
    const path = [];
    let current: HTMLElement | null = el;
    while (current && current !== document.body) {
        let name = current.tagName.toLowerCase();
        if (current.id) name += `#${current.id}`;
        if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(' ').filter(c => !c.includes(':') && c.length > 0).slice(0, 2);
            if (classes.length > 0) name += `.${classes.join('.')}`;
        }
        path.unshift(name);
        current = current.parentElement;
    }
    return path.join(" > ");
}
