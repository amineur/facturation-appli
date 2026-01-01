
import { PrismaClient, MembershipRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();


async function main() {
    const email = `demo-${Date.now()}@example.com`;
    const password = "password123";
    const hashedPassword = await hash(password, 10);

    console.log(`Creating user: ${email} with password: ${password}`);

    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            fullName: "Demo Tester",
            emailVerified: true
        }
    });

    console.log("User created:", user.id);

    console.log("Creating template society...");
    const template = await prisma.societe.create({
        data: {
            nom: "Ma Société (Démo)",
            isTemplate: true,
            adresse: "1 Avenue des Champs-Elysées",
            memberships: {
                create: {
                    userId: user.id,
                    role: MembershipRole.OWNER
                }
            }
        }
    });
    console.log("Template created:", template.id);
    console.log("CREDENTIALS_JSON:", JSON.stringify({ email, password }));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
