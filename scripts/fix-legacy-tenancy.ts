import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting legacy tenancy data migration...");

  // 1. Ensure a default 'Legacy Client' exists
  let defaultClient = await prisma.client.findFirst({
    where: { name: "Legacy System Client" },
  });

  if (!defaultClient) {
    defaultClient = await prisma.client.create({
      data: {
        name: "Legacy System Client",
        websiteUrl: "https://optiqsport.com",
      },
    });
    console.log(`✅ Created default legacy client: ${defaultClient.id}`);
  } else {
    console.log(`ℹ️ Found existing default legacy client: ${defaultClient.id}`);
  }

  // 2. Find all users who have NO ClientUser association
  const unlinkedUsers = await prisma.user.findMany({
    where: {
      clientUsers: {
        none: {},
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log(`🔍 Found ${unlinkedUsers.length} users with no associated client.`);

  // 3. Link them to the default client
  let linkedCount = 0;
  for (const user of unlinkedUsers) {
    try {
      await prisma.clientUser.create({
        data: {
          clientId: defaultClient.id,
          userId: user.id,
        },
      });
      linkedCount++;
      console.log(`🔗 Linked user ${user.email} (${user.role}) to Legacy System Client.`);
    } catch (err) {
      console.error(`❌ Failed to link user ${user.email}:`, err);
    }
  }

  // 4. Update any Tournaments that might somehow be missing a client (if optional, though schema says required)
  // Since the schema says 'clientId' is required, legacy tournaments probably got assigned one during migration,
  // but if we need to move them to this Legacy Client, we could do it here. 
  // For now, linking the users is the main block.
  
  console.log(`🎉 Successfully linked ${linkedCount} legacy users to the Legacy System Client.`);
}

main()
  .catch((e) => {
    console.error("❌ Error running legacy tenancy migration:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
