import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogsService } from "./audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import { Role, Prisma } from "@prisma/client";
import { ForbiddenException } from "@nestjs/common";
import { AuthenticatedUser } from "../common/interfaces/user.interface";

describe("AuditLogsService", () => {
  let service: AuditLogsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("recordLog", () => {
    it("should create an audit log with given values", async () => {
      const createdLog = {
        id: "log-1",
        actorUserId: "user-1",
        actorRole: "ADMIN",
        clientId: "client-1",
        action: "DELETE",
        entityType: "tournament",
        entityId: "tourn-1",
        before: { name: "Tourn 1" },
        after: null,
        createdAt: new Date(),
      };
      mockPrismaService.auditLog.create.mockResolvedValue(createdLog);

      const result = await service.recordLog(
        mockPrismaService as unknown as PrismaService,
        {
          actorUserId: "user-1",
          actorRole: "ADMIN",
          clientId: "client-1",
          action: "DELETE",
          entityType: "tournament",
          entityId: "tourn-1",
          before: { name: "Tourn 1" },
        },
      );

      expect(result).toEqual(createdLog);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: "user-1",
          actorRole: "ADMIN",
          clientId: "client-1",
          action: "DELETE",
          entityType: "tournament",
          entityId: "tourn-1",
          before: { name: "Tourn 1" },
          after: Prisma.JsonNull,
        },
      });
    });

    it("should set Prisma.JsonNull when before and after are undefined", async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({ id: "log-2" });

      await service.recordLog(mockPrismaService as unknown as PrismaService, {
        actorUserId: "user-1",
        actorRole: "SUPER_ADMIN",
        action: "CREATE_API_KEY",
        entityType: "client_api_key",
        entityId: "key-1",
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: "user-1",
          actorRole: "SUPER_ADMIN",
          clientId: null,
          action: "CREATE_API_KEY",
          entityType: "client_api_key",
          entityId: "key-1",
          before: Prisma.JsonNull,
          after: Prisma.JsonNull,
        },
      });
    });
  });

  describe("findAll", () => {
    const superAdminUser: AuthenticatedUser = {
      id: "super-1",
      email: "super@test.com",
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    };

    const adminUser: AuthenticatedUser = {
      id: "admin-1",
      email: "admin@test.com",
      name: "Admin User",
      role: Role.ADMIN,
      clientIds: ["client-abc"],
    };

    it("should allow SUPER_ADMIN to query all logs without client restriction", async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([{ id: "log-1" }]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll(superAdminUser, {
        page: 1,
        limit: 10,
        entityType: "tournament",
        action: "DELETE",
      });

      expect(result.items).toEqual([{ id: "log-1" }]);
      expect(result.meta.itemCount).toBe(1);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType: { equals: "tournament", mode: "insensitive" },
            action: { equals: "DELETE", mode: "insensitive" },
          },
          skip: 0,
          take: 10,
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("should scope ADMIN queries to user clientIds[0]", async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      const result = await service.findAll(adminUser, {
        page: 1,
        limit: 10,
      });

      expect(result.items).toEqual([]);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clientId: "client-abc",
          },
        }),
      );
    });

    it("should throw ForbiddenException if ADMIN has no clientIds", async () => {
      const unassignedAdmin: AuthenticatedUser = {
        id: "admin-2",
        email: "admin2@test.com",
        name: "Unassigned Admin",
        role: Role.ADMIN,
        clientIds: [],
      };

      await expect(
        service.findAll(unassignedAdmin, { page: 1, limit: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should filter by actorUserId and date range", async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.findAll(superAdminUser, {
        actorUserId: "user-99",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-01-31T23:59:59.999Z",
        page: 2,
        limit: 5,
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            actorUserId: "user-99",
            createdAt: {
              gte: new Date("2026-01-01T00:00:00.000Z"),
              lte: new Date("2026-01-31T23:59:59.999Z"),
            },
          },
          skip: 5,
          take: 5,
        }),
      );
    });
  });
});
