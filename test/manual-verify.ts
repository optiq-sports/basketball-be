import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import * as request from "supertest";

async function run() {
  console.log("Initializing App...");
  const app = await NestFactory.create(AppModule);
  // app.setGlobalPrefix('api'); // Check if main.ts sets a prefix
  await app.init();

  const prisma = app.get<PrismaService>(PrismaService);

  console.log("Cleaning DB...");
  try {
    await prisma.matchStat.deleteMany();
    await prisma.matchPlayer.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  } catch (e) {
    console.error("Error cleaning DB:", e);
  }

  console.log("Creating Super Admin...");
  const hashedPassword = await bcrypt.hash("superadmin123", 10);
  try {
    await prisma.user.create({
      data: {
        email: "super@optiq.com",
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        name: "Super Admin",
        emailVerified: true,
      },
    });
  } catch (e) {
    console.error("Error creating super admin:", e);
  }

  console.log("Logging in...");
  let superAdminToken = "";
  try {
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login") // Ensure path is correct. If Global Prefix exists, add it.
      .send({ email: "super@optiq.com", password: "superadmin123" })
      .expect(201);
    superAdminToken = loginRes.body.access_token;
    console.log("Login successful, token:", superAdminToken ? "YES" : "NO");
  } catch (e) {
    console.error("Login failed:", e);
    // Print response body if available in error
    if ((e as any).response) {
      console.error("Response:", (e as any).response.body);
    }
    process.exit(1);
  }

  console.log("Creating Admin...");
  try {
    await request(app.getHttpServer())
      .post("/admin")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        email: "admin@optiq.com",
        password: "adminpassword",
        name: "Test Admin",
        role: "ADMIN",
      })
      .expect(201);
    console.log("Admin created.");
  } catch (e) {
    console.error("Create Admin failed:", e);
    if ((e as any).response)
      console.error("Response:", (e as any).response.body);
  }

  console.log("Creating Statistician...");
  try {
    await request(app.getHttpServer())
      .post("/statistician")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        email: "stat@optiq.com",
        firstName: "John",
        lastName: "Doe",
        bio: "Expert Statistician",
      })
      .expect(201);
    console.log("Statistician created.");
  } catch (e) {
    console.error("Create Statistician failed:", e);
    if ((e as any).response)
      console.error("Response:", (e as any).response.body);
  }

  await app.close();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
