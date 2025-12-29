
import { prisma } from '../src/lib/prisma';

async function listUsers() {
    console.log('Listing all users in DB...');
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                fullName: true,
                createdAt: true,
                role: true
            }
        });

        if (users.length === 0) {
            console.log('❌ No users found in database.');
        } else {
            console.log(`✅ Found ${users.length} users:`);
            users.forEach(u => {
                console.log(`- [${u.id}] ${u.email} (${u.fullName}) - Created: ${u.createdAt}`);
            });
        }
    } catch (error) {
        console.error('Error fetching users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listUsers();
