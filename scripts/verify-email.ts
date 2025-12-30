import { prisma } from '../src/lib/prisma';

async function verifyEmail(email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return;
        }

        if (user.emailVerified) {
            console.log(`✅ Email already verified: ${email}`);
            return;
        }

        await prisma.user.update({
            where: { email },
            data: { emailVerified: true }
        });

        console.log(`✅ Email verified successfully: ${email}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
    console.log('Usage: npx tsx scripts/verify-email.ts <email>');
    process.exit(1);
}

verifyEmail(email);
