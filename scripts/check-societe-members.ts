
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({ include: { societes: true } });
    const societes = await prisma.societe.findMany({ include: { members: true }, orderBy: { createdAt: 'desc' }, take: 5 });

    console.log("Users:", users.map(u => ({ id: u.id, email: u.email, societes: u.societes.map(s => s.nom) })));
    console.log("Recent Societes:", societes.map(s => ({ id: s.id, nom: s.nom, memberCount: s.members.length, members: s.members.map(m => m.email) })));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
