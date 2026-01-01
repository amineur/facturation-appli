
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      }
    });

    const societes = await prisma.societe.findMany({
      select: {
        nom: true,
        id: true,
        email: true,
      }
    });

    console.log('\n--- USERS (' + users.length + ') ---');
    users.forEach(u => {
      console.log(`- [${u.role}] ${u.email} (${u.fullName || 'No Name'})`);
    });

    console.log('\n--- SOCIETES (' + societes.length + ') ---');
    societes.forEach(s => {
      console.log(`- ${s.nom} (ID: ${s.id})`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
