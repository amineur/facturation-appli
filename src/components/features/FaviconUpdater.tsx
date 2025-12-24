"use client";

import { useEffect } from "react";
import { useData } from "@/components/data-provider";

export function FaviconUpdater() {
    const { societe } = useData();
    const logoUrl = societe?.logoUrl;

    useEffect(() => {
        if (!logoUrl) return;

        const updateFavicon = async () => {
            try {
                // Fetch et conversion en Blob
                const response = await fetch(logoUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                // Types de liens à mettre à jour
                const linkTypes = [
                    { rel: 'icon', sizes: null },
                    { rel: 'shortcut icon', sizes: null },
                    { rel: 'apple-touch-icon', sizes: null }
                ];

                linkTypes.forEach(({ rel, sizes }) => {
                    // Chercher un lien existant (RÉUTILISER au lieu de SUPPRIMER)
                    let link = document.querySelector<HTMLLinkElement>(
                        sizes
                            ? `link[rel="${rel}"][sizes="${sizes}"]`
                            : `link[rel="${rel}"]`
                    );

                    // Si pas trouvé, en créer un nouveau
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = rel;
                        if (sizes) link.sizes.value = sizes;
                        document.head.appendChild(link);
                    }

                    // Mettre à jour (ou définir) les attributs
                    link.href = blobUrl;
                    link.type = blob.type;
                });

                console.log('✅ Favicon mis à jour via réutilisation des liens existants');

                // Cleanup function
                return () => {
                    URL.revokeObjectURL(blobUrl);
                };
            } catch (error) {
                console.error('❌ Erreur lors de la mise à jour du favicon:', error);
            }
        };

        const cleanupPromise = updateFavicon();

        return () => {
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, [logoUrl]);

    return null;
}
