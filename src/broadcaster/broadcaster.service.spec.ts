import { Test, TestingModule } from "@nestjs/testing";
import { BroadcasterService } from "./broadcaster.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { EmailService } from "../notifications/email.service";
import { Role, UserStatus } from "@prisma/client";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { AuthenticatedUser } from "../common/interfaces/user.interface";

describe("BroadcasterService", () => {
  let service: BroadcasterService;
  let prisma: PrismaService;
  let emailService: EmailService;

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
    matchBroadcaster: {
      findMany: jest.fn(),
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

  const mockEmailService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  };

  const mockAdminUser: AuthenticatedUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User",
    role: Role.ADMIN,
    clientIds: ["client-1"],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcasterService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<BroadcasterService>(BroadcasterService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should throw ConflictException if user with email already exists with different role", async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "test@example.com",
        role: Role.CLIENT,
        clientUsers: [],
      });

      await expect(
        service.create(
          { email: "test@example.com", name: "Broadcaster Test" },
          mockAdminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("should link existing broadcaster to a new client if already a broadcaster", async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({
          id: "broadcaster-1",
          email: "existing@example.com",
          role: Role.BROADCASTER,
          clientUsers: [{ clientId: "client-other" }],
        })
        .mockResolvedValueOnce({
          id: "broadcaster-1",
          email: "existing@example.com",
          name: "Existing Broadcaster",
          role: Role.BROADCASTER,
          profile: { fullName: "Existing Broadcaster" },
        });

      mockPrismaService.clientUser.create.mockResolvedValueOnce({
        id: "cu-1",
        clientId: "client-1",
        userId: "broadcaster-1",
      });

      const result = await service.create(
        { email: "existing@example.com" },
        mockAdminUser,
      );

      expect(mockPrismaService.clientUser.create).toHaveBeenCalledWith({
        data: { clientId: "client-1", userId: "broadcaster-1" },
      });
      expect(result.id).toBe("broadcaster-1");
      expect(result.emailSent).toBe(false);
    });

    it("should create a new broadcaster user, profile, clientUser, and send welcome email", async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // no existing
        .mockResolvedValueOnce({
          id: "new-user-1",
          email: "new@broadcaster.com",
          name: "New Broadcaster",
          role: Role.BROADCASTER,
          status: UserStatus.ACTIVE,
          profile: { id: "p-1", fullName: "New Broadcaster" },
        });

      mockPrismaService.user.create.mockResolvedValueOnce({
        id: "new-user-1",
        email: "new@broadcaster.com",
        role: Role.BROADCASTER,
      });

      mockPrismaService.userProfile.create.mockResolvedValueOnce({
        id: "p-1",
        userId: "new-user-1",
      });

      mockPrismaService.clientUser.create.mockResolvedValueOnce({
        id: "cu-1",
        clientId: "client-1",
        userId: "new-user-1",
      });

      const result = await service.create(
        {
          email: "new@broadcaster.com",
          name: "New Broadcaster",
        },
        mockAdminUser,
      );

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "new@broadcaster.com",
            role: Role.BROADCASTER,
            forcePasswordChange: true,
          }),
        }),
      );
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        "new@broadcaster.com",
        expect.any(String),
        Role.BROADCASTER,
      );
      expect(result.emailSent).toBe(true);
      expect(result.id).toBe("new-user-1");
    });
  });

  describe("findAll", () => {
    it("should return paginated broadcasters scoped to client for ADMIN", async () => {
      mockPrismaService.user.findMany.mockResolvedValueOnce([
        {
          id: "b-1",
          email: "b1@example.com",
          name: "Broadcaster 1",
          role: Role.BROADCASTER,
          status: UserStatus.ACTIVE,
          profile: null,
        },
      ]);
      mockPrismaService.user.count.mockResolvedValueOnce(1);

      const result = await service.findAll({}, mockAdminUser);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: Role.BROADCASTER,
            clientUsers: {
              some: { clientId: { in: ["client-1"] } },
            },
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.meta.itemCount).toBe(1);
    });
  });

  describe("findOne", () => {
    it("should throw NotFoundException if broadcaster does not exist", async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findOne("non-existent", mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if broadcaster does not belong to admin's client", async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: "b-other",
        role: Role.BROADCASTER,
        clientUsers: [{ clientId: "different-client" }],
      });

      await expect(service.findOne("b-other", mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return broadcaster with assigned matches", async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: "b-1",
        email: "b1@example.com",
        role: Role.BROADCASTER,
        clientUsers: [{ clientId: "client-1" }],
        profile: { fullName: "Broadcaster 1" },
      });

      mockPrismaService.matchBroadcaster.findMany.mockResolvedValueOnce([
        {
          id: "mb-1",
          matchId: "match-1",
          match: {
            id: "match-1",
            homeTeam: { id: "team-1", name: "Team 1" },
            awayTeam: { id: "team-2", name: "Team 2" },
            scheduledDate: new Date(),
            venue: "Arena",
            status: "SCHEDULED",
            tournamentId: "t-1",
            homeScore: 0,
            awayScore: 0,
          },
        },
      ]);

      const result = await service.findOne("b-1", mockAdminUser);

      expect(result.id).toBe("b-1");
      expect(result.assignedMatches).toHaveLength(1);
      expect(result.assignedMatches[0].matchId).toBe("match-1");
    });
  });

  describe("remove", () => {
    it("should deactivate broadcaster and record audit log", async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: "b-1",
        role: Role.BROADCASTER,
        status: UserStatus.ACTIVE,
      });

      mockPrismaService.user.update.mockResolvedValueOnce({
        id: "b-1",
        role: Role.BROADCASTER,
        status: UserStatus.INACTIVE,
      });

      const result = await service.remove("b-1", mockAdminUser);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: "b-1" },
        data: { status: UserStatus.INACTIVE },
        omit: { password: true },
      });
      expect(mockAuditLogsService.recordLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "DELETE",
          entityType: "broadcaster",
          entityId: "b-1",
        }),
      );
      expect(result.status).toBe(UserStatus.INACTIVE);
    });
  });
});
