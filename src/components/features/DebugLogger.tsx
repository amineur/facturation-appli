"use client";

import { useEffect } from "react";

export function DebugLogger() {
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.log("[Debug] Application loaded in development mode");
        }
    }, []);

    return null;
}
