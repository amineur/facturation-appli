import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma_new: PrismaClient };

export const prisma =
    globalForPrisma.prisma_new ||
    new PrismaClient({
        log: ['query'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma_new = prisma;
