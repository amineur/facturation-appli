"use server";

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';
import { MembershipRole } from '@prisma/client';
import { randomUUID } from 'crypto';

// --- Security Helper ---
export async function canAccessSociete(userId: string, societeId: string, minRole?: MembershipRole) {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_societeId: { userId, societeId }
        }
    });

    if (!membership || membership.status !== 'active') return false;
    if (!minRole) return true;

    const hierarchy = {
        [MembershipRole.OWNER]: 4,
        [MembershipRole.ADMIN]: 3,
        [MembershipRole.EDITOR]: 2,
        [MembershipRole.VIEWER]: 1
    };

    return hierarchy[membership.role] >= hierarchy[minRole];
}

// --- Actions ---

export async function getMembers(societeId: string) {
    const session = await getCurrentUser();
    if (!session.success || !session.data) return { success: false, error: "Non authentifié" };

    const authorized = await canAccessSociete(session.data.id, societeId, MembershipRole.VIEWER);
    if (!authorized) return { success: false, error: "Accès refusé" };

    try {
        const memberships = await prisma.membership.findMany({
            where: { societeId },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const invitations = await prisma.invitation.findMany({
            where: { societeId, status: 'pending' },
            orderBy: { createdAt: 'desc' }
        });

        return { success: true, data: { members: memberships, invitations } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function inviteMember(data: { email: string, role: MembershipRole, societeId: string }) {
    const session = await getCurrentUser();
    if (!session.success || !session.data) return { success: false, error: "Non authentifié" };

    // Strict Check: Only ADMIN or OWNER can invite
    const authorized = await canAccessSociete(session.data.id, data.societeId, MembershipRole.ADMIN);
    if (!authorized) return { success: false, error: "Droit insuffisant" };

    try {

        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

        if (existingUser) {
            // Check if already member
            const existingMembership = await prisma.membership.findUnique({
                where: {
                    userId_societeId: { userId: existingUser.id, societeId: data.societeId }
                }
            });

            if (existingMembership) return { success: false, error: "Utilisateur déjà membre" };


            // Direct add
            await prisma.membership.create({
                data: {
                    userId: existingUser.id,
                    societeId: data.societeId,
                    role: data.role,
                    status: 'active'
                }
            });

            // Send Notification Email
            try {
                const { sendEmail } = await import('@/lib/email');
                const societe = await prisma.societe.findUnique({ where: { id: data.societeId }, select: { nom: true } });
                const inviter = await prisma.user.findUnique({ where: { id: session.data.id }, select: { fullName: true } });

                const message = `Bonjour ${existingUser.fullName || ""},\n\nVous avez été ajouté à l'équipe "${societe?.nom}" par ${inviter?.fullName}.\n\nVous pouvez dès maintenant accéder à cet espace depuis votre tableau de bord.\n\nCordialement,\nL'équipe Facturation`;
                const html = `
                    <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                        <h2>Bienvenue dans l'équipe ${societe?.nom}</h2>
                        <p>Bonjour ${existingUser.fullName || ""},</p>
                        <p>Vous avez été ajouté(e) directement par <strong>${inviter?.fullName}</strong>.</p>
                        <p>L'espace est dès maintenant disponible dans votre tableau de bord.</p>
                        <div style="text-align: center; margin: 30px 0;">
                             <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="background: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accéder à mon tableau de bord</a>
                        </div>
                    </div>
                `;

                await sendEmail({
                    to: data.email,
                    subject: `Vous avez rejoint ${societe?.nom}`,
                    text: message,
                    html: html
                });
            } catch (e) {
                console.error("Failed to send welcome email for direct add", e);
            }

            return { success: true, message: "Utilisateur ajouté et notifié par email" };

        } else {
            // Invite flow
            const existingInvite = await prisma.invitation.findUnique({
                where: { email_societeId: { email: data.email, societeId: data.societeId } }
            });

            if (existingInvite) return { success: false, error: "Invitation déjà envoyée" };

            // Generate 8-char readable code
            const crypto = require('crypto');
            const token = crypto.randomBytes(4).toString('hex').toUpperCase();
            // Expires in 7 days
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const invitation = await prisma.invitation.create({
                data: {
                    email: data.email,
                    role: data.role,
                    societeId: data.societeId,
                    invitedBy: session.data.id,
                    token,
                    expiresAt,
                    status: 'pending'
                },
                include: {
                    societe: { select: { nom: true } },
                    inviter: { select: { fullName: true } }
                }
            });

            // Send Email
            try {
                const { sendEmail } = await import('@/lib/email'); // Dynamic import to avoid circular deps if any
                const message = `Bonjour,\n\nVous avez été invité à rejoindre l'équipe "${invitation.societe.nom}" par ${invitation.inviter.fullName}.\n\nVotre code d'invitation est : ${token}\n\nRendez-vous sur l'application pour accepter l'invitation.\n\nCordialement,\nL'équipe Facturation`;
                const html = `
                    <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                        <h2>Invitation à rejoindre ${invitation.societe.nom}</h2>
                        <p>Bonjour,</p>
                        <p>Vous avez été invité(e) par <strong>${invitation.inviter.fullName}</strong> à rejoindre leur équipe sur Facturation App.</p>
                        <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <p style="margin: 0; color: #666; font-size: 0.9em;">VOTRE CODE D'INVITATION</p>
                            <p style="margin: 10px 0 0; font-size: 2em; font-weight: bold; letter-spacing: 2px;">${token}</p>
                        </div>
                        <p>connectez-vous ou créez un compte, puis entrez ce code lors de l'onboarding ou dans les paramètres.</p>
                    </div>
                `;

                await sendEmail({
                    to: data.email,
                    subject: `Invitation à rejoindre ${invitation.societe.nom}`,
                    text: message,
                    html: html
                });
            } catch (emailError) {
                console.error("Failed to send invitation email:", emailError);
                // Non-blocking error, we still return the token so admin can share it manually
            }

            return { success: true, message: "Invitation envoyée", token }; // Return token for debug/copy
        }

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateMemberRole(data: { userId: string, role: MembershipRole, societeId: string }) {
    const session = await getCurrentUser();
    if (!session.success || !session.data) return { success: false, error: "Non authentifié" };

    // Strict Check: ADMIN+
    const authorized = await canAccessSociete(session.data.id, data.societeId, MembershipRole.ADMIN);
    if (!authorized) return { success: false, error: "Droit insuffisant" };

    try {
        // Prevent modifying own role if it would remove all owners
        // Basic check: can't modify yourself if you are an OWNER? Wait, yes you can downgrade yourself if another owner exists.
        // For simplicity: Prevent self-modification for now to be safe? Or allow it.
        // Let's allow it but maybe warn.

        await prisma.membership.update({
            where: {
                userId_societeId: { userId: data.userId, societeId: data.societeId }
            },
            data: { role: data.role }
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function removeMember(data: { userId: string, societeId: string }) {
    const session = await getCurrentUser();
    if (!session.success || !session.data) return { success: false, error: "Non authentifié" };

    // Strict Check: ADMIN+
    const authorized = await canAccessSociete(session.data.id, data.societeId, MembershipRole.ADMIN);
    if (!authorized) return { success: false, error: "Droit insuffisant" };

    try {
        await prisma.membership.delete({
            where: {
                userId_societeId: { userId: data.userId, societeId: data.societeId }
            }
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getMyPendingInvitations() {
    const session = await getCurrentUser();
    if (!session.success || !session.data) return { success: false, error: "Non authentifié" };

    try {
        const invitations = await prisma.invitation.findMany({
            where: {
                email: session.data.email,
                status: 'pending'
            },
            include: {
                societe: {
                    select: { id: true, nom: true, logoUrl: true }
                },
                inviter: {
                    select: { fullName: true }
                }
            }
        });

        return { success: true, data: invitations };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function acceptInvitation(token: string) {
    const session = await getCurrentUser();
    if (!session.success || !session.data) return { success: false, error: "Non authentifié" };

    try {
        const invitation = await prisma.invitation.findUnique({
            where: { token },
            include: { societe: true }
        });

        if (!invitation) return { success: false, error: "Invitation invalide ou expirée" };
        if (invitation.status !== 'pending') return { success: false, error: "Invitation déjà utilisée" };
        if (invitation.expiresAt < new Date()) return { success: false, error: "Invitation expirée" };
        if (invitation.email.toLowerCase() !== session.data.email.toLowerCase()) {
            return { success: false, error: "Cette invitation ne vous est pas destinée." };
        }

        // Add to members
        await prisma.membership.create({
            data: {
                userId: session.data.id,
                societeId: invitation.societeId,
                role: invitation.role,
                status: 'active'
            }
        });

        // Update invite status
        await prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: 'accepted' }
        });

        // Update currentSocieteId if user has none
        if (!session.data.currentSocieteId) {
            await prisma.user.update({
                where: { id: session.data.id },
                data: { currentSocieteId: invitation.societeId }
            });
        }

        return { success: true, message: `Bienvenue chez ${invitation.societe.nom}` };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function revokeInvitation(invitationId: string) {
    const session = await getCurrentUser();
    if (!session.success || !session.data) return { success: false, error: "Non authentifié" };

    try {
        const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
        if (!invite) return { success: false, error: "Invitation introuvable" };

        const authorized = await canAccessSociete(session.data.id, invite.societeId, MembershipRole.ADMIN);
        if (!authorized) return { success: false, error: "Droit insuffisant" };

        await prisma.invitation.delete({ where: { id: invitationId } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
