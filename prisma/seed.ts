import { PrismaClient } from "@prisma/client";
import { seedUsers } from "./seeds/01-users";
import { seedTeamsAndPlayers } from "./seeds/02-teams-players";
import { seedTournamentsAndMatches } from "./seeds/03-tournaments-matches";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting complete database seed...");

  // 1. Clean the database first (optional but recommended for seeds)
  // Be careful with this in production! We will just rely on upserts or unique constraints for now,
  // or we can clean specific tables if needed. 

  // 2. Seed Users & Clients
  const { clients, statisticians } = await seedUsers(prisma);

  // 3. Seed Teams & Players
  const { teams } = await seedTeamsAndPlayers(prisma);

  // 4. Seed Tournaments & Matches
  await seedTournamentsAndMatches(prisma, clients, teams, statisticians);

  console.log("✅ All seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
