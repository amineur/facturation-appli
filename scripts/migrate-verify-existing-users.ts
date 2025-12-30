import { prisma } from '../src/lib/prisma';

/**
 * Migration: Mark all existing users as email verified
 * 
 * This is necessary because we added email verification AFTER users already signed up.
 * We trust that existing users are legitimate since they've been using the app.
 */
async function migrateExistingUsers() {
    try {
        console.log('🔄 Starting migration: Verify existing users...');

        // Find all users with unverified emails
        const unverifiedUsers = await prisma.user.findMany({
            where: { emailVerified: false },
            select: { id: true, email: true, createdAt: true }
        });

        console.log(`📊 Found ${unverifiedUsers.length} unverified users`);

        if (unverifiedUsers.length === 0) {
            console.log('✅ No users to migrate');
            return;
        }

        // Update all to verified
        const result = await prisma.user.updateMany({
            where: { emailVerified: false },
            data: { emailVerified: true }
        });

        console.log(`✅ Successfully verified ${result.count} existing users`);
        console.log('\nVerified users:');
        unverifiedUsers.forEach(user => {
            console.log(`  - ${user.email} (created: ${user.createdAt.toLocaleDateString()})`);
        });

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
migrateExistingUsers()
    .then(() => {
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });
