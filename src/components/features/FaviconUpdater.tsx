"use client";

import { useEffect } from "react";
import { useData } from "@/components/data-provider";

export function FaviconUpdater() {
    const { societe } = useData();

    useEffect(() => {
        const updateFavicon = (url: string) => {
            const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = url;
            document.getElementsByTagName('head')[0].appendChild(link);
        };

        if (societe?.logoUrl) {
            updateFavicon(societe.logoUrl);
        } else {
            // Optional: Revert to default or keep previous
            // updateFavicon('/favicon.ico'); 
        }
    }, [societe?.logoUrl]);

    return null; // Headless component
}
