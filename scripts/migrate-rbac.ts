import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log("🚀 Starting Safe RBAC Migration...");

    // Fetch all societies
    const societes = await prisma.societe.findMany({
        include: {
            members: true, // Fetch implicit members
        }
    });

    console.log(`📦 Found ${societes.length} societies to migrate.`);

    for (const societe of societes) {
        console.log(`\n🏢 Migrating Societe: ${societe.nom} (${societe.id})`);

        // 1. Identify OWNER (Creator)
        // Heuristic: Look for 'create' action in History
        const creationLog = await prisma.historyEntry.findFirst({
            where: {
                societeId: societe.id,
                action: 'create',
                entityType: 'societe'
            },
            orderBy: { timestamp: 'asc' }
        });

        let ownerId = creationLog?.userId;

        // Fallback: Check Global Admins if no history
        if (!ownerId && societe.members.length > 0) {
            const adminMember = societe.members.find(m => m.role === 'admin');
            if (adminMember) {
                ownerId = adminMember.id;
                console.log(`   ⚠️ No creation log. Fallback Owner (Global Admin): ${adminMember.fullName}`);
            } else {
                // Last Resort: First member
                ownerId = societe.members[0].id;
                console.log(`   ⚠️ No creation log or admin. Fallback Owner (First Member): ${societe.members[0].fullName}`);
            }
        }

        if (!ownerId) {
            console.log("   ❌ No members found. Skipping ownership assignment.");
        }

        // 2. Create Memberships
        for (const member of societe.members) {
            // Check if membership already exists
            const existing = await prisma.membership.findUnique({
                where: {
                    userId_societeId: {
                        userId: member.id,
                        societeId: societe.id
                    }
                }
            });

            if (existing) {
                console.log(`   ⏩ Membership already exists for ${member.email} (${existing.role})`);
                continue;
            }

            // DANGEROUS FIX: Determine Role
            // User Rule: "owner" -> OWNER, others -> VIEWER (Safe Default)
            let role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' = 'VIEWER';

            if (member.id === ownerId) {
                role = 'OWNER';
            } else if (member.role === 'admin') {
                // If they are global admin but NOT the owner, maybe give them ADMIN?
                // User said: "Others = VIEWER (Safe Default)".
                // But a Global Admin probably expects Admin access.
                // Let's stick to SAFE DEFAULT as requested, but maybe 'EDITOR' for global admins?
                // NO, "JAMAIS admin par défaut sans certitude".
                // I will strictly follow: Creator = OWNER, Others = VIEWER.
                role = 'VIEWER';
            }

            await prisma.membership.create({
                data: {
                    userId: member.id,
                    societeId: societe.id,
                    role: role,
                    status: 'active'
                }
            });

            console.log(`   ✅ Migrated ${member.email} -> ${role}`);
        }
    }

    console.log("\n✨ Migration Complete!");
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
