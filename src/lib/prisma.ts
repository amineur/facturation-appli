import { PrismaClient } from '@prisma/client';

import path from 'path';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
};

// --- FIX: Robust SQLite Path Resolution ---
// Problem: Next.js + Turbopack changes 'cwd' depending on context (API vs Page vs Action)
// Solution: If using SQLite relative path (file:./...), resolve it ABSOLUTELY from project root.

let datasourceUrl = process.env.DATABASE_URL;

if (datasourceUrl && datasourceUrl.startsWith("file:.") && !datasourceUrl.startsWith("file:/")) {
    // 1. Extract purely relative path (e.g. ./data/dev.db)
    const relativePart = datasourceUrl.replace("file:", "");

    // 2. Resolve absolute path
    // IMPORTANT: process.cwd() is reliable for project root in most Node environments
    const absolutePath = path.resolve(process.cwd(), relativePart);

    // 3. Reconstruct correct connection string
    datasourceUrl = `file:${absolutePath}`;

    console.log(`[DB_INFO] 🛠️  Fixed SQLite path: ${datasourceUrl}`);
} else {
    // Keep original if absolute or not sqlite
    console.log('[DB_INFO] Using provided DATABASE_URL=', process.env.DATABASE_URL);
}

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ['query', 'error', 'warn'],
        datasources: {
            db: {
                url: datasourceUrl,
            },
        },
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
