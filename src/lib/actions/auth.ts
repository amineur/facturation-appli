"use server";

import { prisma } from '@/lib/prisma';
import { User } from '@/types';
import { cookies } from "next/headers";

function mapUser(prismaUser: any): User {
    return {
        id: prismaUser.id,
        email: prismaUser.email,
        fullName: prismaUser.fullName || "",
        role: prismaUser.role as any,
        permissions: [],
        societes: prismaUser.societes?.map((s: any) => s.id) || [],
        currentSocieteId: prismaUser.currentSocieteId || prismaUser.societes?.[0]?.id,
        lastReadHistory: prismaUser.lastReadHistory ? prismaUser.lastReadHistory.toISOString() : undefined,
        password: prismaUser.password,
        avatarUrl: prismaUser.avatarUrl,
        hasAvatar: prismaUser.hasAvatar
    };
}

export async function registerUser(data: any) {
    try {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) return { success: false, error: "Cet email est déjà utilisé" };

        const user = await prisma.user.create({
            data: {
                email: data.email,
                fullName: data.fullName,
                password: data.password, // In PROD: Hash this!
                role: data.role || "user",
                avatarUrl: data.avatarUrl,
                societes: {
                    connect: data.societes?.map((id: string) => ({ id })) || []
                }
            },
            include: {
                societes: {
                    select: {
                        id: true,
                        nom: true,
                        logoUrl: true
                    }
                }
            }
        });

        const cookieStore = await cookies();
        cookieStore.set("session_userid", user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/"
        });

        return { success: true, data: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function loginUser(email: string, password: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                societes: {
                    select: {
                        id: true,
                        nom: true,
                        logoUrl: true
                    }
                }
            }
        });

        if (!user || user.password !== password) { // In PROD: Use bcrypt.compare
            return { success: false, error: "Email ou mot de passe incorrect" };
        }

        const cookieStore = await cookies();
        cookieStore.set("session_userid", user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/"
        });

        return { success: true, data: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getDefaultUser() {
    try {
        // Try to get usr_1 first (standard default)
        let user = await prisma.user.findUnique({
            where: { id: 'usr_1' },
            include: {
                societes: {
                    select: {
                        id: true,
                        nom: true,
                        logoUrl: true
                    }
                }
            }
        });

        // If not found, get first user in DB (dev fallback)
        // If not found, DO NOT fall back to first user (Security Risk)
        if (!user) {
            return { success: false, error: "Utilisateur par défaut introuvable" };
        }

        if (!user) {
            return { success: false, error: "No users found in database" };
        }

        return { success: true, data: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCurrentUser() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("session_userid")?.value;

        if (token) {
            // If token looks like a raw ID
            if (token.startsWith("usr_") || token.length > 10) {
                return await fetchUserById(token);
            }
            // Or if it's JSON
            try {
                const parsed = JSON.parse(token);
                if (parsed.id) return await fetchUserById(parsed.id);
            } catch (e) { }
        }

        return { success: false, error: "Non authentifié" };
    } catch (e) {
        return { success: false, error: "Erreur authentification" };
    }
}

export async function updateUser(userData: any) {
    try {
        const user = await prisma.user.update({
            where: { id: userData.id },
            data: {
                email: userData.email,
                fullName: userData.fullName,
                password: userData.password,
                role: userData.role,
                avatarUrl: userData.avatarUrl
                // Societes update logic requires disconnect/connect, skipping for simple update
            },
            include: {
                societes: {
                    select: {
                        id: true,
                        nom: true,
                        logoUrl: true
                    }
                }
            }
        });
        return { success: true, data: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function upsertUser(userData: any) {
    try {
        // Enforce DB constraints via Prisma Upsert
        // If id matches, Update. If not, Create.
        // We match on ID primarily. 

        const user = await prisma.user.upsert({
            where: { id: userData.id || "new_user" }, // Fallback to avoid error, but usage should provide ID
            update: {
                email: userData.email,
                fullName: userData.fullName,
                password: userData.password,
                role: userData.role,
                avatarUrl: userData.avatarUrl
            },
            create: {
                id: userData.id, // Explicit ID allowed (e.g. usr_1)
                email: userData.email,
                fullName: userData.fullName,
                password: userData.password,
                role: userData.role || "user",
                avatarUrl: userData.avatarUrl,
                societes: {
                    connect: userData.societes?.map((id: string) => ({ id })) || []
                }
            },
            include: {
                societes: {
                    select: {
                        id: true,
                        nom: true,
                        logoUrl: true
                    }
                }
            }
        });

        // Ensure we always return the fresh DB state
        return { success: true, data: mapUser(user) };
    } catch (error: any) {
        console.error("Upsert User Failed:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchAllUsers() {
    try {
        const users = await prisma.user.findMany({
            include: {
                societes: {
                    select: {
                        id: true,
                        nom: true,
                        logoUrl: true
                    }
                }
            }
        });
        return { success: true, data: users.map(mapUser) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchUserById(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                societes: {
                    select: {
                        id: true,
                        nom: true,
                        logoUrl: true
                    }
                }
            }
        });
        if (!user) return { success: false, error: "Utilisateur introuvable" };
        return { success: true, data: mapUser(user) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markHistoryAsRead(userId: string) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { lastReadHistory: new Date() }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateUserProfile(data: { fullName?: string; email?: string; currentPassword?: string; newPassword?: string }) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get("session_userid")?.value;

        if (!userId) return { success: false, error: "Non authentifié" };

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { success: false, error: "Utilisateur introuvable" };

        const updateData: any = {};
        if (data.fullName) updateData.fullName = data.fullName;
        if (data.email) updateData.email = data.email;

        // Verify current password if changing password
        if (data.newPassword) {
            if (!data.currentPassword) {
                return { success: false, error: "Mot de passe actuel requis pour changer de mot de passe" };
            }
            if (user.password !== data.currentPassword) {
                return { success: false, error: "Mot de passe actuel incorrect" };
            }
            updateData.password = data.newPassword;
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        // Update session cookie if needed (optional but good practice)
        // But Next.js server actions handle this mostly via data.

        return { success: true, data: mapUser(updated) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
