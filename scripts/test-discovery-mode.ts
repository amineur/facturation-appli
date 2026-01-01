
import { prisma } from "../src/lib/prisma";
import { createTemplateSociete } from "../src/lib/actions/template-societe";
import { hash } from "bcryptjs";

async function testDiscoveryMode() {
    console.log("🚀 Starting Discovery Mode Test...");

    // 1. Create a fresh test user
    const email = `test-discovery-${Date.now()}@example.com`;
    const password = await hash("password123", 10);

    const user = await prisma.user.create({
        data: {
            email,
            password,
            fullName: "Test Discovery User"
        }
    });

    console.log(`✅ Created test user: ${user.email} (${user.id})`);

    // 2. Simulate "Discovery Mode" click (call the action)
    console.log("🔄 Simulating 'Discovery Mode' click...");
    const template = await createTemplateSociete(user.id);

    // 3. Verify specific properties
    if (!template) {
        console.error("❌ Failed: No template society returned.");
        process.exit(1);
    }

    if (template.nom !== "Ma Société (Démo)") {
        console.error(`❌ Failed: Expected name 'Ma Société (Démo)', got '${template.nom}'`);
        process.exit(1);
    }

    if (!template.isTemplate) {
        console.error("❌ Failed: Society is not marked as template (isTemplate=false)");
        process.exit(1);
    }

    // 4. Check database directly to be sure
    const dbSociete = await prisma.societe.findUnique({
        where: { id: template.id },
        include: { memberships: true }
    });

    if (!dbSociete) {
        console.error("❌ Failed: Society not found in DB");
        process.exit(1);
    }

    // Verify membership
    const membership = dbSociete.memberships.find(m => m.userId === user.id);
    if (!membership || membership.role !== "OWNER") {
        console.error("❌ Failed: User is not OWNER of the society");
        process.exit(1);
    }

    console.log("✅ SUCCESS: Discovery Mode correctly created a template society!");
    console.log(`   Société ID: ${template.id}`);
    console.log(`   Owner ID: ${user.id}`);

    // Cleanup
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.societe.delete({ where: { id: template.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("🧹 Cleanup complete.");
}

testDiscoveryMode()
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
