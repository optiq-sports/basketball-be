import { Test, TestingModule } from "@nestjs/testing";
import { StatisticianService } from "./statistician.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Role } from "@prisma/client";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AuthenticatedUser } from "../common/interfaces/user.interface";

describe("StatisticianService", () => {
  let service: StatisticianService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    clientUser: {
      create: jest.fn(),
    },
    client: {
      findUnique: jest.fn().mockResolvedValue({ id: "client-kaduna" }),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(mockPrismaService),
      ),
  };

  const mockAuditLogsService = {
    recordLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticianService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<StatisticianService>(StatisticianService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    const adminUser: AuthenticatedUser = {
      id: "admin-1",
      name: "Admin User",
      email: "admin@example.com",
      role: Role.ADMIN,
      clientIds: ["client-kaduna"],
    };

    const superAdminUser: AuthenticatedUser = {
      id: "super-1",
      name: "Super Admin",
      email: "super@example.com",
      role: Role.SUPER_ADMIN,
      clientIds: [],
    };

    it("should throw ConflictException if user email already exists", async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: "existing-id",
        email: "irene@example.com",
      });

      await expect(
        service.create(
          {
            email: "irene@example.com",
            firstName: "Irene",
            lastName: "Basil",
          },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("should automatically link newly created statistician to creator admin's client", async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({
          id: "stat-new",
          email: "irene@example.com",
          role: Role.STATISTICIAN,
        }); // find after creation

      mockPrismaService.user.create.mockResolvedValueOnce({
        id: "stat-new",
        email: "irene@example.com",
        role: Role.STATISTICIAN,
      });
      mockPrismaService.userProfile.create.mockResolvedValueOnce({});
      mockPrismaService.clientUser.create.mockResolvedValueOnce({});

      const result = await service.create(
        {
          email: "irene@example.com",
          firstName: "Irene",
          lastName: "Basil",
        },
        adminUser,
      );

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "irene@example.com",
            role: Role.STATISTICIAN,
          }),
        }),
      );

      expect(mockPrismaService.clientUser.create).toHaveBeenCalledWith({
        data: {
          clientId: "client-kaduna",
          userId: "stat-new",
        },
      });

      expect(result).toBeDefined();
    });

    it("should link to specified clientId if provided and admin is authorized for it", async () => {
      const adminWithMultipleClients: AuthenticatedUser = {
        id: "admin-2",
        name: "Admin Two",
        email: "admin2@example.com",
        role: Role.ADMIN,
        clientIds: ["client-1", "client-2"],
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "stat-new-2",
          email: "stat2@example.com",
        });
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: "stat-new-2",
      });
      mockPrismaService.userProfile.create.mockResolvedValueOnce({});
      mockPrismaService.clientUser.create.mockResolvedValueOnce({});

      await service.create(
        {
          email: "stat2@example.com",
          firstName: "John",
          lastName: "Doe",
          clientId: "client-2",
        },
        adminWithMultipleClients,
      );

      expect(mockPrismaService.clientUser.create).toHaveBeenCalledWith({
        data: {
          clientId: "client-2",
          userId: "stat-new-2",
        },
      });
    });

    it("should throw ForbiddenException if admin attempts to link to a client outside their assigned clients", async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            email: "stat-unauthorized@example.com",
            firstName: "Alex",
            lastName: "Smith",
            clientId: "foreign-client",
          },
          adminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if target clientId does not exist", async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.client.findUnique.mockResolvedValueOnce(null);

      const superAdmin: AuthenticatedUser = {
        id: "super-1",
        email: "super@example.com",
        role: Role.SUPER_ADMIN,
      };

      await expect(
        service.create(
          {
            email: "stat-unknown-client@example.com",
            firstName: "Alex",
            lastName: "Smith",
            clientId: "unknown-client-id",
          },
          superAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should allow SUPER_ADMIN to link to any client", async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "stat-super",
          email: "statsuper@example.com",
        });
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: "stat-super",
      });
      mockPrismaService.userProfile.create.mockResolvedValueOnce({});
      mockPrismaService.clientUser.create.mockResolvedValueOnce({});

      await service.create(
        {
          email: "statsuper@example.com",
          firstName: "Super",
          lastName: "Stat",
          clientId: "any-client-id",
        },
        superAdminUser,
      );

      expect(mockPrismaService.clientUser.create).toHaveBeenCalledWith({
        data: {
          clientId: "any-client-id",
          userId: "stat-super",
        },
      });
    });

    it("should not create clientUser if SUPER_ADMIN creates a statistician without specifying a clientId", async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "stat-no-client",
          email: "statnoclient@example.com",
        });
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: "stat-no-client",
      });
      mockPrismaService.userProfile.create.mockResolvedValueOnce({});

      await service.create(
        {
          email: "statnoclient@example.com",
          firstName: "Global",
          lastName: "Stat",
        },
        superAdminUser,
      );

      expect(mockPrismaService.clientUser.create).not.toHaveBeenCalled();
    });
  });
});
