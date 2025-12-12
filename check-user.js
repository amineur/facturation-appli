
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- TEST: UPSERT Logic ---");

  // 1. Test Creation of new user
  const newUserId = "usr_test_" + Date.now();
  console.log(`1. Testing creation of non-existent user: ${newUserId}`);

  const createdUser = await prisma.user.upsert({
    where: { id: newUserId },
    update: {},
    create: {
      id: newUserId,
      email: `test_${newUserId}@example.com`,
      fullName: "Test User Created",
      password: "password123",
      role: "user"
    }
  });
  console.log("   ✅ Created:", createdUser.id === newUserId);

  // 2. Test Update of existing user (usr_1)
  console.log("2. Testing update of existing user 'usr_1'");
  // First get current
  const before = await prisma.user.findUnique({ where: { id: "usr_1" } });
  console.log("   Current Email:", before ? before.email : "NOT FOUND");

  // Perform Upsert (Mocking what upsertUser does)
  const updatedUser = await prisma.user.upsert({
    where: { id: "usr_1" },
    update: {
      fullName: "Amine Ben Abla (Verified)" // Changing name to verify update
    },
    create: {
      id: "usr_1",
      email: "amine@urbanhit.fr",
      fullName: "Amine Ben Abla",
      password: "admin"
    }
  });

  console.log("   ✅ Updated Name:", updatedUser.fullName);

  // 3. Verify Persistence (Read back)
  const after = await prisma.user.findUnique({ where: { id: "usr_1" } });
  console.log("   Persistent State:", after.fullName);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
