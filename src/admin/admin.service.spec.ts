import { Test, TestingModule } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";
import { Role, UserStatus } from "@prisma/client";
import {
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";

import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

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
            $transaction: jest
              .fn()
              .mockImplementation(async (cb) => cb(prisma)),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            recordLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
            findAll: jest.fn(),
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
    const currentUser: AuthenticatedUser = {
      id: "user1",
      email: "super@test.com",
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    };

    const validDto: CreateAdminDto = {
      email: "test@test.com",
      firstName: "Test",
      lastName: "User",
      role: Role.ADMIN,
    };

    it("should throw ConflictException if user already exists", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing",
      });

      await expect(service.create(currentUser, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should successfully create user and send email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const mockNewUser = {
        id: "new",
        email: "test@test.com",
        role: Role.ADMIN,
      };
      (prisma.user.create as jest.Mock).mockResolvedValue(mockNewUser);

      const result = await service.create(currentUser, validDto);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        mockNewUser.email,
        expect.any(String),
        mockNewUser.role,
      );
      expect(result).toEqual({ ...mockNewUser, emailSent: true });
    });

    it("should return emailSent false when auto-generated password email fails", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const mockNewUser = {
        id: "new",
        email: "test@test.com",
        role: Role.ADMIN,
      };
      (prisma.user.create as jest.Mock).mockResolvedValue(mockNewUser);
      (emailService.sendWelcomeEmail as jest.Mock).mockResolvedValue(false);

      const result = await service.create(currentUser, validDto);

      expect(result).toEqual({ ...mockNewUser, emailSent: false });
    });
  });
});
