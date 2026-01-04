
import { Facture, Devis, LigneItem } from "@/types";

const DRAFT_PREFIX = "invoice_draft_";
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24h

export interface DraftData {
    items: LigneItem[];
    clientId?: string;
    dateEmission?: string;
    echeance?: string;
    conditions?: string;
    notes?: string;
    statut?: string;
    numero?: string;
    remiseGlobale?: number;
    remiseGlobaleType?: 'pourcentage' | 'montant';
    isLocked?: boolean;

    // Config specifique
    defaultTva?: number;
    showDateColumn?: boolean;
    showTTCColumn?: boolean;
    showQuantiteColumn?: boolean;
    showTvaColumn?: boolean;
    showRemiseColumn?: boolean;
    showOptionalFields?: boolean;
    discountEnabled?: boolean;
    discountType?: 'pourcentage' | 'montant';
    conditionsPaiement?: string;

    updatedAt: number;
}

export const saveDraft = (id: string, data: Partial<DraftData>) => {
    try {
        const key = `${DRAFT_PREFIX}${id || 'new'}`;

        // Read existing to merge (Crucial for Partial updates from Desktop that doesn't have all fields)
        const existingRaw = localStorage.getItem(key);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};

        const payload: DraftData = {
            ...existing,
            ...data,
            items: data.items || existing.items || [],
            updatedAt: Date.now()
        };
        console.log(`[STORAGE] Saving draft for key: ${key}`, {
            source: data.items ? 'Update' : 'Patch',
            items: payload.items?.length,
            tva: payload.defaultTva
        });
        localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
        console.error("[STORAGE] Failed to save draft", e);
    }
};

export const getDraft = (id: string): DraftData | null => {
    try {
        const key = `${DRAFT_PREFIX}${id || 'new'}`;
        console.log(`[STORAGE] Reading draft for key: ${key}`);
        const raw = localStorage.getItem(key);
        if (!raw) {
            console.log(`[STORAGE] No draft found for key: ${key}`);
            return null;
        }

        const data = JSON.parse(raw) as DraftData;

        // Expiration check
        if (Date.now() - data.updatedAt > EXPIRATION_MS) {
            localStorage.removeItem(key);
            return null;
        }

        return data;
    } catch (e) {
        return null;
    }
};

export const clearDraft = (id: string) => {
    try {
        const key = `${DRAFT_PREFIX}${id || 'new'}`;
        localStorage.removeItem(key);
    } catch (e) {
        // ignore
    }
};
