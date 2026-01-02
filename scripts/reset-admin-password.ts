
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'amine@urbanhit.fr';
    const newPassword = 'password';

    console.log(`Resetting password for ${email}...`);

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            console.error(`User ${email} not found!`);
            process.exit(1);
        }

        // Updating to plain text "password". 
        // The login route logic supports plain text if it doesn't start with "$2" (bcrypt prefix).
        await prisma.user.update({
            where: { email },
            data: {
                password: newPassword
            },
        });

        console.log(`✅ Password for ${email} has been reset to: "${newPassword}"`);
    } catch (e) {
        console.error('Error updating password:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
