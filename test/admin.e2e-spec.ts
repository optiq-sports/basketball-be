import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { Role } from "@prisma/client";

describe("Admin & Statistician Modules (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up
    await prisma.matchStat.deleteMany();
    await prisma.matchPlayer.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    // Create Super Admin
    const hashedPassword = await bcrypt.hash("superadmin123", 10);
    const superAdmin = await prisma.user.create({
      data: {
        email: "super@optiq.com",
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        name: "Super Admin",
        emailVerified: true,
      },
    });

    // Login to get token
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "super@optiq.com", password: "superadmin123" })
      .expect(201);

    superAdminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe("Admin Module", () => {
    it("should create an admin user", async () => {
      const createDto = {
        email: "admin@optiq.com",
        password: "adminpassword",
        name: "Test Admin",
        role: "ADMIN",
      };

      await request(app.getHttpServer())
        .post("/admin")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(201);

      const admin = await prisma.user.findUnique({
        where: { email: createDto.email },
      });
      expect(admin).toBeDefined();
      expect(admin?.role).toBe("ADMIN");
      expect(admin?.name).toBe("Test Admin");
    });

    it("should list admins", async () => {
      await request(app.getHttpServer())
        .get("/admin")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // Should at least have the Super Admin and the newly created Admin
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });
  });

  describe("Statistician Module", () => {
    it("should create a statistician user with profile", async () => {
      const createDto = {
        email: "stat@optiq.com",
        firstName: "John",
        lastName: "Doe",
        dobDay: 15,
        dobMonth: 5,
        dobYear: 1990,
        phone: "1234567890",
        country: "USA",
        state: "NY",
        homeAddress: "123 Main St",
        bio: "Expert Statistician",
      };

      // Statistician creation does not require password in DTO, should default to 123456789
      await request(app.getHttpServer())
        .post("/statistician")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(201);

      const statUser = await prisma.user.findUnique({
        where: { email: createDto.email },
        include: { profile: true },
      });

      expect(statUser).toBeDefined();
      expect(statUser?.role).toBe("STATISTICIAN");
      expect(statUser?.name).toBe("John Doe"); // Name constructed from first+last

      // Verify default password
      const isPasswordValid = await bcrypt.compare(
        "123456789",
        statUser!.password!,
      );
      expect(isPasswordValid).toBe(true);

      expect(statUser?.profile).toBeDefined();
      expect(statUser?.profile?.bio).toBe("Expert Statistician");
      expect(statUser?.profile?.phone).toBe("1234567890");
    });

    it("should list statisticians", async () => {
      await request(app.getHttpServer())
        .get("/statistician")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
        });
    });
  });
});
