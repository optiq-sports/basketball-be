import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { firstNames, lastNames, randomItem } from "./utils";

export async function seedUsers(prisma: PrismaClient) {
  console.log("Seeding users, clients, and statisticians...");

  const password = await bcrypt.hash("password123", 10);

  // 1. Create Admins
  const admin = await prisma.user.upsert({
    where: { email: "admin@optiqsport.com" },
    update: {},
    create: {
      email: "admin@optiqsport.com",
      password,
      role: "ADMIN",
      emailVerified: true,
      profile: {
        create: { fullName: "System Admin" }
      }
    }
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "super@optiqsport.com" },
    update: {},
    create: {
      email: "super@optiqsport.com",
      password,
      role: "SUPER_ADMIN",
      emailVerified: true,
      profile: {
        create: { fullName: "Super Admin" }
      }
    }
  });

  // 2. Create 3 Statisticians
  const statisticians = [];
  for (let i = 1; i <= 3; i++) {
    const stat = await prisma.user.upsert({
      where: { email: `stat${i}@optiqsport.com` },
      update: {},
      create: {
        email: `stat${i}@optiqsport.com`,
        password,
        role: "STATISTICIAN",
        emailVerified: true,
        profile: {
          create: { fullName: `${randomItem(firstNames)} ${randomItem(lastNames)}` }
        }
      }
    });
    statisticians.push(stat);
  }

  const testManager = await prisma.user.upsert({
    where: { email: "test-client-manager@optiq.com" },
    update: {},
    create: {
      email: "test-client-manager@optiq.com",
      password,
      role: "CLIENT",
      emailVerified: true,
      profile: { create: { fullName: "Test Manager" } }
    }
  });

  const testViewer = await prisma.user.upsert({
    where: { email: "test-client-viewer@optiq.com" },
    update: {},
    create: {
      email: "test-client-viewer@optiq.com",
      password,
      role: "CLIENT",
      emailVerified: true,
      profile: { create: { fullName: "Test Viewer" } }
    }
  });

  // 3. Create 5-6 Clients
  const clients = [];
  const clientCount = 6;

  for (let i = 1; i <= clientCount; i++) {
    const clientUser = await prisma.user.upsert({
      where: { email: `client${i}@optiqsport.com` },
      update: {},
      create: {
        email: `client${i}@optiqsport.com`,
        password,
        role: "CLIENT",
        emailVerified: true,
        profile: {
          create: { fullName: `Client ${i} Rep` }
        }
      }
    });

    const client = await prisma.client.create({
      data: {
        name: `Organization ${i}`,
        websiteUrl: `https://org${i}.com`,
        clientUsers: {
          create: i === 1 ? [
            { userId: clientUser.id }, // The client user role
            { userId: admin.id }, // Assigned to the admin
            { userId: superAdmin.id },
            { userId: testManager.id },
            { userId: testViewer.id },
            ...statisticians.map(s => ({ userId: s.id }))
          ] : [
            { userId: clientUser.id },
            { userId: admin.id },
            { userId: testManager.id },
            { userId: testViewer.id }
          ]
        }
      }
    });

    clients.push(client);
  }

  return { admin, superAdmin, statisticians, clients };
}
