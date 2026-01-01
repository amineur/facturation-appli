"use server";

import { prisma } from "@/lib/prisma";
import { MembershipRole } from "@prisma/client";
import { revalidatePath } from 'next/cache';

/**
 * Creates a "Template" (Demo) society for the user if they don't have one.
 * Uses a fixed "Ma Société (Démo)" name and dummy data.
 * Idempotent: returns existing template if found.
 */
export async function createTemplateSociete(userId: string) {
    if (!userId) return null;

    // Check if user already has a template society
    const existingTemplate = await prisma.societe.findFirst({
        where: {
            isTemplate: true,
            memberships: {
                some: { userId: userId, role: MembershipRole.OWNER }
            }
        }
    });

    if (existingTemplate) {
        // Ensure user is switched to this template
        await prisma.user.update({
            where: { id: userId },
            data: { currentSocieteId: existingTemplate.id }
        });
        revalidatePath('/');
        return existingTemplate;
    }

    // Get user details for pre-filling (e.g. email)
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Create the Template Society
    const template = await prisma.societe.create({
        data: {
            nom: "Ma Société (Démo)",
            isTemplate: true,
            adresse: "1 Avenue des Champs-Elysées",
            codePostal: "75008",
            ville: "Paris",
            pays: "France",
            siret: "00000000000000",
            email: user?.email || "contact@demo.fr",
            mentionsLegales: "Ceci est une société de démonstration.",
            memberships: {
                create: {
                    userId: userId,
                    role: MembershipRole.OWNER
                }
            }
        }
    });

    // Switch user to new society
    await prisma.user.update({
        where: { id: userId },
        data: { currentSocieteId: template.id }
    });

    revalidatePath('/');
    return template;
}

/**
 * Migrates a Template Society to a Real Society.
 * - If keepData is true: Moves all data to new society, deletes template.
 * - If keepData is false: Deletes template and all data, creates fresh society.
 */
export async function migrateTemplateToReal(
    userId: string,
    newSocieteData: any,
    keepData: boolean
) {
    try {
        // 1. Find the User's Template Society
        const template = await prisma.societe.findFirst({
            where: {
                isTemplate: true,
                memberships: {
                    some: { userId: userId, role: MembershipRole.OWNER }
                }
            }
        });

        if (!template) {
            return { success: false, error: "Aucune société de démo trouvée à activer." };
        }

        const realSociete = await prisma.$transaction(async (tx) => {
            // Filter data to only include valid Societe fields if needed, 
            // but for now we rely on Prisma ignoring extra fields or we pick common ones.
            // Safer to pick common ones to avoid "Unknown arg" error from Prisma.
            const { nom, adresse, codePostal, ville, pays, siret, tvaIntra, formeJuridique, rcs, email, telephone, siteWeb, logoUrl, primaryColor, banque, iban, bic, titulaireCompte, mentionsLegales } = newSocieteData;

            const cleanData = {
                nom, adresse, codePostal, ville, pays, siret, tvaIntra, formeJuridique, rcs, email, telephone, siteWeb, logoUrl, primaryColor, banque, iban, bic, titulaireCompte, mentionsLegales
            };

            // Remove undefined fields
            Object.keys(cleanData).forEach(key => (cleanData as any)[key] === undefined && delete (cleanData as any)[key]);


            // 2. Create the Real Society
            const real = await tx.societe.create({
                data: {
                    ...cleanData,
                    isTemplate: false,
                    memberships: {
                        create: {
                            userId: userId,
                            role: MembershipRole.OWNER
                        }
                    }
                }
            });

            if (keepData) {
                // OPTION A: KEEP DATA -> Move entities to new Society ID

                // Move Clients
                await tx.client.updateMany({
                    where: { societeId: template.id },
                    data: { societeId: real.id }
                });

                // Move Products
                await tx.produit.updateMany({
                    where: { societeId: template.id },
                    data: { societeId: real.id }
                });

                // Move Invoices (Factures)
                await tx.facture.updateMany({
                    where: { societeId: template.id },
                    data: { societeId: real.id }
                });

                // Move Quotes (Devis)
                await tx.devis.updateMany({
                    where: { societeId: template.id },
                    data: { societeId: real.id }
                });

                // Move History? Optional, but good for continuity if generic
                // Note: HistoryEntry has societeId relation.
                await tx.historyEntry.updateMany({
                    where: { societeId: template.id },
                    data: { societeId: real.id }
                });

            } else {
                // OPTION B: RESET -> Manual Cascade Delete
                // Since our schema might not have full cascade on all relations

                await tx.factureItem.deleteMany({ where: { facture: { societeId: template.id } } });
                await tx.paiement.deleteMany({ where: { facture: { societeId: template.id } } });
                await tx.facture.deleteMany({ where: { societeId: template.id } });

                await tx.devisItem.deleteMany({ where: { devis: { societeId: template.id } } });
                await tx.devis.deleteMany({ where: { societeId: template.id } });

                await tx.produit.deleteMany({ where: { societeId: template.id } });
                await tx.client.deleteMany({ where: { societeId: template.id } });

                // Invitations, History...
                await tx.invitation.deleteMany({ where: { societeId: template.id } });
                await tx.historyEntry.deleteMany({ where: { societeId: template.id } });
            }

            // 3. Delete the Old Template Society (Membership will cascade delete)
            await tx.societe.delete({
                where: { id: template.id }
            });

            return real;
        });

        return { success: true, data: realSociete };

    } catch (error: any) {
        console.error("Migration error:", error);
        return { success: false, error: error.message || "Erreur lors de la migration" };
    }
}
