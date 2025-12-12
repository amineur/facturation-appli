"use client";

import { useEffect } from "react";
import { useData } from "@/components/data-provider";

export function FaviconUpdater() {
    const { societe } = useData();

    useEffect(() => {
        if (!societe?.logoUrl) return;

        let currentObjectUrl: string | null = null;

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

        const replaceLink = (rel: string, finalUrl: string, mimeType?: string) => {
            // Find ALL existing links that match this rel
            const existingLinks = document.querySelectorAll(`link[rel='${rel}']`);
            existingLinks.forEach(link => link.remove());

            const link = document.createElement('link');
            link.rel = rel;
            link.href = finalUrl;

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
            // Cache bust for remote URLs to force refresh
            finalUrl = `${societe.logoUrl}?t=${new Date().getTime()}`;
        }

        // Hard Swap: Remove old tags and add new ones.
        // This forces Safari to re-evaluate the icon.
        replaceLink('icon', finalUrl, mimeType);
        replaceLink('shortcut icon', finalUrl, mimeType);
        replaceLink('apple-touch-icon', finalUrl, mimeType);

        if (mimeType === 'image/svg+xml' || (!isDataUri && societe.logoUrl.toLowerCase().endsWith('.svg'))) {
            replaceLink('mask-icon', finalUrl, mimeType);
        }

        // Cleanup function
        return () => {
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
            }
        };

    }, [societe?.logoUrl]); // Re-run whenever logoUrl changes

    return null;
}
