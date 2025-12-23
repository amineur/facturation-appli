"use client";

import { useEffect, useRef } from "react";
import { useData } from "@/components/data-provider";

export function FaviconUpdater() {
    const { societe } = useData();

    const createdLinksRef = useRef<HTMLLinkElement[]>([]);

    useEffect(() => {
        if (!societe?.logoUrl) return;

        let currentObjectUrl: string | null = null;
        const currentLinks: HTMLLinkElement[] = [];

        const dataURItoBlob = (dataURI: string) => {
            try {
                const byteString = atob(dataURI.split(',')[1]);
                const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                return new Blob([ab], { type: mimeString });
            } catch (e) {
                console.error("Failed to convert data URI to Blob", e);
                return null;
            }
        };

        const addLink = (rel: string, finalUrl: string, mimeType?: string) => {
            const link = document.createElement('link');
            link.rel = rel;
            link.href = finalUrl;
            link.dataset.managedBy = "glass-favicon-updater";

            // Apply specific type logic
            if (mimeType) {
                link.type = mimeType;
            } else if (societe.logoUrl!.toLowerCase().endsWith('.svg')) {
                if (rel === 'mask-icon') {
                    link.setAttribute('color', societe.primaryColor || '#000000');
                } else if (rel !== 'apple-touch-icon') {
                    link.type = 'image/svg+xml';
                }
            }

            document.head.appendChild(link);
            currentLinks.push(link);
        };

        // Cleanup PREVIOUS links from THIS component instance only
        const cleanupLinks = () => {
            createdLinksRef.current.forEach((link: HTMLLinkElement) => {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
            });
            createdLinksRef.current = [];
        };

        // Determine the URL to use
        const isDataUri = societe.logoUrl.startsWith('data:');
        let finalUrl = societe.logoUrl;
        let mimeType = '';

        if (isDataUri) {
            const blob = dataURItoBlob(societe.logoUrl);
            if (blob) {
                currentObjectUrl = URL.createObjectURL(blob);
                finalUrl = currentObjectUrl;
                mimeType = blob.type;
            }
        } else {
            finalUrl = `${societe.logoUrl}?t=${new Date().getTime()}`;
        }

        // 1. Clean up old links before adding new ones
        cleanupLinks();

        // 2. Add new links
        addLink('icon', finalUrl, mimeType);
        addLink('shortcut icon', finalUrl, mimeType);
        addLink('apple-touch-icon', finalUrl, mimeType);

        if (mimeType === 'image/svg+xml' || (!isDataUri && societe.logoUrl.toLowerCase().endsWith('.svg'))) {
            addLink('mask-icon', finalUrl, mimeType);
        }

        // 3. Store new links in ref for next cycle or unmount
        createdLinksRef.current = currentLinks;

        return () => {
            cleanupLinks();
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
            }
        };

    }, [societe?.logoUrl, societe?.primaryColor]); // Re-run whenever logoUrl changes

    return null;
}
