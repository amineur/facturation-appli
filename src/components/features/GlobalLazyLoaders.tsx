"use client";

import dynamic from "next/dynamic";

export const FaviconUpdater = dynamic(
    () => import("./FaviconUpdater").then((mod) => mod.FaviconUpdater),
    { ssr: false }
);

export const DebugLogger = dynamic(
    () => import("./DebugLogger").then((mod) => mod.DebugLogger),
    { ssr: false }
);
