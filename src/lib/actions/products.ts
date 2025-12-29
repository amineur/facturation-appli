"use server";

import { prisma } from '@/lib/prisma';
import { Produit } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultUser } from './auth';

// Helper to Auto-Create Products (Used by Invoices and Quotes)
// Helper to Auto-Create Products (Used by Invoices and Quotes)
export async function ensureProductsExist(items: any[], societeId: string, tx?: any) {
    if (!items || !Array.isArray(items)) return [];

    const db = tx || prisma; // Use transaction if provided, otherwise use global prisma

    console.log("[DEBUG_SERVER] ensureProductsExist input:", items.length, "items", "SocieteId:", societeId);

    const processedItems = [...items];

    // 1. Identify potential new products (items without a valid product ID but have a name)
    // We group by name to avoid duplicate creations in the same batch
    const productsToProcess = new Map<string, any>();

    for (const item of processedItems) {
        // Resolve product name from 'nom' or 'description'
        // Ideally we only do this for type='produit' but let's be safe
        const rawName = item.nom || item.description;

        if (!item.produitId && rawName && rawName.trim() !== "") {
            productsToProcess.set(rawName.trim(), item);
        }
    }

    // 2. Batch check existing products
    if (productsToProcess.size > 0) {
        const names = Array.from(productsToProcess.keys());
        const existingProducts = await db.produit.findMany({
            where: {
                societeId: societeId,
                nom: { in: names }
            }
        });

        // 3. Create missing products
        for (const name of names) {
            const existing = existingProducts.find(p => p.nom === name);
            let finalProductId = existing?.id;

            if (!existing) {
                // CREATE NEW
                try {
                    const templateItem = productsToProcess.get(name)!;
                    console.log(`[AUTO-CREATE] Creating new product: "${name}"`);
                    const newProduct = await db.produit.create({
                        data: {
                            societeId: societeId,
                            nom: name,
                            description: templateItem.description || "", // Use description as description too
                            prixUnitaire: typeof templateItem.prixUnitaire === 'number' ? templateItem.prixUnitaire : parseFloat(templateItem.prixUnitaire) || 0,
                            tva: typeof templateItem.tva === 'number' ? templateItem.tva : parseFloat(templateItem.tva) || 20
                        }
                    });
                    finalProductId = newProduct.id;
                } catch (err) {
                    console.error(`[AUTO-CREATE] Failed to create product "${name}"`, err);
                }
            }

            // 4. Update items with the resolved Product ID
            if (finalProductId) {
                for (const item of processedItems) {
                    const itemName = item.nom || item.description;
                    if (itemName && itemName.trim() === name && !item.produitId) {
                        item.produitId = finalProductId;
                        // Also ensure 'nom' is set for consistency if it was missing
                        if (!item.nom) item.nom = name;
                    }
                }
            }
        }
    }

    // Final pass: validations and calculations
    return processedItems.map(item => {
        const qty = typeof item.quantite === 'number' ? item.quantite : parseFloat(item.quantite) || 0;
        const price = typeof item.prixUnitaire === 'number' ? item.prixUnitaire : parseFloat(item.prixUnitaire) || 0;
        let total = qty * price;

        const remise = typeof item.remise === 'number' ? item.remise : parseFloat(item.remise) || 0;
        if (remise > 0) {
            if (item.remiseType === 'montant') {
                total = Math.max(0, total - remise);
            } else {
                total = total * (1 - remise / 100);
            }
        }

        return {
            ...item,
            id: item.id || uuidv4(),
            quantite: qty,
            prixUnitaire: price,
            montantHT: total
        };
    });
}

export async function fetchProducts(societeId: string): Promise<{ success: boolean, data?: Produit[], error?: string }> {
    try {
        const products = await prisma.produit.findMany({
            where: { societeId }
        });

        const mapped: Produit[] = products.map((p: any) => ({
            id: p.id,
            societeId: p.societeId,
            nom: p.nom,
            description: p.description || "",
            prixUnitaire: p.prixUnitaire,
            tva: p.tva
        }));
        return { success: true, data: mapped };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createProduct(product: Produit) {
    try {
        // 🔒 SECURITY: Verify access
        const userRes = await getDefaultUser();
        if (!userRes.success || !userRes.data) return { success: false, error: "Non authentifié" };

        const targetSocieteId = product.societeId || userRes.data.currentSocieteId;
        if (!targetSocieteId) return { success: false, error: "Société non spécifiée" };

        const hasAccess = await prisma.societe.findFirst({
            where: { id: targetSocieteId, members: { some: { id: userRes.data.id } } }
        });
        if (!hasAccess) return { success: false, error: "Accès refusé" };

        const res = await prisma.produit.create({
            data: {
                societeId: targetSocieteId,
                nom: product.nom,
                prixUnitaire: product.prixUnitaire,
                tva: product.tva,
                description: product.description
            }
        });
        return { success: true, id: res.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateProduct(product: Produit) {
    if (!product.id) return { success: false, error: "ID manquant" };
    try {
        await prisma.produit.update({
            where: { id: product.id },
            data: {
                nom: product.nom,
                prixUnitaire: product.prixUnitaire,
                tva: product.tva,
                description: product.description
            }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
