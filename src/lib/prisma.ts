import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['error', 'warn']
            : ['error'], // [AUDIT] Reverted to safe defaults
        // Optionnel: configurer ici si .env ne suffit pas
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Cleanup automatique des connexions (pour éviter les zombies)

// Cleanup logic removed to prevent MaxListenersExceededWarning in dev

