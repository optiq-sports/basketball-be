import { Test, TestingModule } from "@nestjs/testing";
import { AdminService } from "../src/admin/admin.service";
import { StatisticianService } from "../src/statistician/statistician.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { AppModule } from "../src/app.module";
import { Role, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

async function run() {
  console.log("Initializing module...");
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const adminService = moduleRef.get<AdminService>(AdminService);
  const statisticianService =
    moduleRef.get<StatisticianService>(StatisticianService);
  const prisma = moduleRef.get<PrismaService>(PrismaService);

  console.log("Cleaning DB...");
  await prisma.matchStat.deleteMany();
  await prisma.matchPlayer.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log("Testing AdminService.create...");
  const admin = await adminService.create({
    email: "admin@test.com",
    password: "password123",
    name: "Test Admin",
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  });
  console.log("Created Admin:", admin.id, admin.role);

  console.log("Testing AdminService.findAll...");
  const admins = await adminService.findAll();
  console.log("Found Admins:", admins.length);
  if (admins.length !== 1) throw new Error("Expected 1 admin");

  console.log("Testing StatisticianService.create...");
  const stat = await statisticianService.create({
    email: "stat@test.com",
    firstName: "Stat",
    lastName: "Man",
    bio: "I love stats",
  });
  console.log("Created Statistician:", stat.id, stat.role);

  // Verify default password
  const isMatch = await bcrypt.compare("123456789", stat.password!);
  console.log("Default password valid:", isMatch);
  if (!isMatch) throw new Error("Default password invalid");

  console.log("Testing StatisticianService.findAll...");
  const stats = await statisticianService.findAll();
  console.log("Found Statisticians:", stats.length);
  if (stats.length !== 1) throw new Error("Expected 1 statistician");

  const fetchedStat = await statisticianService.findOne(stat.id);
  console.log("Fetched Profile Bio:", fetchedStat.profile?.bio);

  await prisma.$disconnect();
  await moduleRef.close();
  console.log("Verification Success!");
}

run().catch((e) => {
  console.error("Verification Failed:", e);
  process.exit(1);
});
