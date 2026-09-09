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

  const customPassword = "123456";
  const customHashedPassword = await bcrypt.hash(customPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: {},
    create: {
      email: "admin@gmail.com",
      password: customHashedPassword,
      role: "ADMIN",
      emailVerified: true,
      profile: {
        create: {
          fullName: "System Admin",
        },
      },
    },
  });

  const statisticianUser = await prisma.user.upsert({
    where: { email: "stat@gmail.com" },
    update: {},
    create: {
      email: "stat@gmail.com",
      password: customHashedPassword,
      role: "STATISTICIAN",
      emailVerified: true,
      profile: {
        create: {
          fullName: "System Statistician",
        },
      },
    },
  });

  console.log("✅ Seed complete:", user.email, adminUser.email, statisticianUser.email);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
