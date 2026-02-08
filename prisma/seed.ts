// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const password = "password123"; // default admin password
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: "test@basketball.com" },
    update: {},
    create: {
      email: "test@basketball.com",
      password: hashedPassword, // renamed field
      role: "ADMIN",
      emailVerified: true, // now a Boolean
      profile: {
        create: {
          fullName: "Test Admin",
          bio: "Coach of the university basketball team.",
        },
      },
    },
  });

  console.log("✅ Seed complete:", user);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
