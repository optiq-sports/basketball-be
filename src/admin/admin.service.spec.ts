import { Test, TestingModule } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";
import { Role, UserStatus } from "@prisma/client";
import { ConflictException, InternalServerErrorException } from "@nestjs/common";

describe("AdminService", () => {
  let service: AdminService;
  let prisma: PrismaService;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const currentUser = { id: "user1", role: Role.SUPER_ADMIN };

    it("should throw ConflictException if user already exists", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "existing" });

      await expect(
        service.create(currentUser, { email: "test@test.com" } as any),
      ).rejects.toThrow(ConflictException);
    });

    it("should successfully create user in a transaction and send email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const mockNewUser = {
        id: "new",
        email: "test@test.com",
        role: Role.ADMIN,
      };
      (prisma.user.create as jest.Mock).mockResolvedValue(mockNewUser);

      const result = await service.create(currentUser, { email: "test@test.com" } as any);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        mockNewUser.email,
        expect.any(String),
        mockNewUser.role,
      );
      expect(result).toEqual({ ...mockNewUser, emailSent: true });
    });

    it("should throw InternalServerErrorException if email fails", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "new",
        email: "test@test.com",
        role: Role.ADMIN,
      });
      (emailService.sendWelcomeEmail as jest.Mock).mockResolvedValue(false);

      await expect(
        service.create(currentUser, { email: "test@test.com" } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
