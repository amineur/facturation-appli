"use client";

import dynamic from "next/dynamic";

export const MobileNav = dynamic(
    () => import("./MobileNav").then((mod) => mod.MobileNav),
    { ssr: false }
);

export const MobileHeader = dynamic(
    () => import("./MobileHeader").then((mod) => mod.MobileHeader),
    { ssr: false }
);
