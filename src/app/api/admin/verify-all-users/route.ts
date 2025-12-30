import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * TEMPORARY ENDPOINT - DELETE AFTER USE
 * 
 * This endpoint verifies all existing users in the database.
 * Use this once after deploying email verification to grandfather existing users.
 * 
 * Usage: GET /api/admin/verify-all-users
 */
export async function GET(request: Request) {
    try {
        console.log('🔄 Starting migration: Verify existing users...');

        // Find all users with unverified emails
        const unverifiedUsers = await prisma.user.findMany({
            where: { emailVerified: false },
            select: { id: true, email: true, createdAt: true }
        });

        console.log(`📊 Found ${unverifiedUsers.length} unverified users`);

        if (unverifiedUsers.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No users to migrate',
                count: 0
            });
        }

        // Update all to verified
        const result = await prisma.user.updateMany({
            where: { emailVerified: false },
            data: { emailVerified: true }
        });

        console.log(`✅ Successfully verified ${result.count} existing users`);

        const userList = unverifiedUsers.map(user => ({
            email: user.email,
            createdAt: user.createdAt.toISOString()
        }));

        return NextResponse.json({
            success: true,
            message: `Successfully verified ${result.count} existing users`,
            count: result.count,
            users: userList
        });

    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
