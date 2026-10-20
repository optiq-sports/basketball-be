import { Test, TestingModule } from "@nestjs/testing";
import { MatchesService } from "./matches.service";
import { PrismaService } from "../prisma/prisma.service";
import { MatchStatus, Role } from "@prisma/client";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { AuthenticatedUser } from "src/common/interfaces/user.interface";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

describe("MatchesService", () => {
  let service: MatchesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    match: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tournament: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    tournamentTeam: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    matchBroadcaster: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(mockPrismaService),
      ),
  };

  const mockAuditLogsService = {
    recordLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
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

    service = module.get<MatchesService>(MatchesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUser: AuthenticatedUser = {
    id: "user1",
    email: "user@test.com",
    name: "Test User",
    role: Role.SUPER_ADMIN,
    clientIds: [],
  };

  describe("create", () => {
    const createDto = {
      tournamentId: "tour1",
      homeTeamId: "team1",
      awayTeamId: "team2",
      scheduledDate: "2026-01-01T00:00:00Z",
    };

    it("should throw NotFoundException if tournament not found", async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue(null);
      await expect(service.create(createDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if home team not found", async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue({});
      mockPrismaService.team.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({});
      await expect(service.create(createDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if home team is not in tournament", async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue({});
      mockPrismaService.team.findUnique.mockResolvedValue({});
      mockPrismaService.tournamentTeam.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({});
      await expect(service.create(createDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if teams are the same", async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue({});
      mockPrismaService.team.findUnique.mockResolvedValue({});
      mockPrismaService.tournamentTeam.findUnique.mockResolvedValue({});
      await expect(
        service.create(
          {
            ...createDto,
            homeTeamId: "team1",
            awayTeamId: "team1",
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create match successfully", async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue({});
      mockPrismaService.team.findUnique.mockResolvedValue({});
      mockPrismaService.tournamentTeam.findUnique.mockResolvedValue({});
      mockPrismaService.match.create.mockResolvedValue({ id: "match1" });

      const result = await service.create(createDto, mockUser);
      expect(result).toEqual({ id: "match1" });
      expect(mockPrismaService.match.create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should find all matches with optional filters", async () => {
      mockPrismaService.match.findMany.mockResolvedValue([{ id: "m1" }]);
      const result = await service.findAll(mockUser, {
        tournamentId: "tour1",
        status: MatchStatus.LIVE,
      });
      expect(result.items).toEqual([{ id: "m1" }]);
      expect(mockPrismaService.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tournamentId: "tour1",
            status: MatchStatus.LIVE,
          }),
        }),
      );
    });

    it("should scope matches to client when called by CLIENT user", async () => {
      const clientUser: AuthenticatedUser = {
        id: "client_user_1",
        email: "operator@broadcast.tv",
        name: "Broadcast Operator",
        role: Role.CLIENT,
        clientIds: ["broadcast_client_1"],
      };
      mockPrismaService.match.findMany.mockResolvedValue([
        { id: "m_broadcast" },
      ]);
      mockPrismaService.match.count.mockResolvedValue(1);

      const result = await service.findAll(clientUser, {});
      expect(result.items).toEqual([{ id: "m_broadcast" }]);
      expect(mockPrismaService.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { clientId: { in: ["broadcast_client_1"] } },
              { tournament: { clientId: { in: ["broadcast_client_1"] } } },
            ],
          }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should throw NotFoundException if match not found", async () => {
      mockPrismaService.match.findFirst.mockResolvedValue(null);
      await expect(service.findOne("invalid", mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return match if found", async () => {
      mockPrismaService.match.findFirst.mockResolvedValue({ id: "m1" });
      const result = await service.findOne("m1", mockUser);
      expect(result).toEqual({ id: "m1", gameSessions: [] });
    });

    it("should enforce client tenant scoping for CLIENT user in findOne", async () => {
      const clientUser: AuthenticatedUser = {
        id: "client_user_1",
        email: "operator@broadcast.tv",
        name: "Broadcast Operator",
        role: Role.CLIENT,
        clientIds: ["broadcast_client_1"],
      };
      mockPrismaService.match.findFirst.mockResolvedValue({
        id: "m_broadcast",
      });

      const result = await service.findOne("m_broadcast", clientUser);
      expect(result).toEqual({ id: "m_broadcast", gameSessions: [] });
      expect(mockPrismaService.match.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "m_broadcast",
            OR: [
              { clientId: { in: ["broadcast_client_1"] } },
              { tournament: { clientId: { in: ["broadcast_client_1"] } } },
            ],
          },
        }),
      );
    });
  });

  describe("update", () => {
    it("should calculate scores and update match", async () => {
      mockPrismaService.match.findFirst.mockResolvedValue({
        id: "m1",
        quarter1Home: 10,
        quarter2Home: 10,
      });
      mockPrismaService.match.update.mockResolvedValue({ id: "m1" });

      await service.update("m1", { quarter3Home: 5 }, mockUser);
      expect(mockPrismaService.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ homeScore: 25 }),
        }),
      );
    });
  });

  describe("remove", () => {
    it("should remove match", async () => {
      mockPrismaService.match.findFirst.mockResolvedValue({ id: "m1" });
      await service.remove("m1", mockUser);
      expect(mockPrismaService.match.delete).toHaveBeenCalledWith({
        where: { id: "m1" },
      });
    });
  });

  describe("broadcaster scoping and assignments", () => {
    const mockBroadcasterUser: AuthenticatedUser = {
      id: "broadcaster-1",
      email: "broadcaster@example.com",
      name: "Broadcaster User",
      role: Role.BROADCASTER,
    };

    it("should filter matches to assigned ones for Role.BROADCASTER in findAll", async () => {
      mockPrismaService.match.findMany.mockResolvedValueOnce([
        { id: "m-assigned" },
      ]);
      mockPrismaService.match.count.mockResolvedValueOnce(1);

      const result = await service.findAll(mockBroadcasterUser, {});

      expect(mockPrismaService.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            broadcasters: {
              some: {
                userId: "broadcaster-1",
              },
            },
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
    });

    it("should filter findOne to assigned match for Role.BROADCASTER", async () => {
      mockPrismaService.match.findFirst.mockResolvedValueOnce({
        id: "m-assigned",
        homeTeam: { playerTeams: [] },
        awayTeam: { playerTeams: [] },
      });

      const result = await service.findOne("m-assigned", mockBroadcasterUser);

      expect(mockPrismaService.match.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "m-assigned",
            broadcasters: {
              some: {
                userId: "broadcaster-1",
              },
            },
          },
        }),
      );
      expect(result.id).toBe("m-assigned");
    });

    it("should throw NotFoundException in findOne if match not assigned to broadcaster", async () => {
      mockPrismaService.match.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findOne("m-unassigned", mockBroadcasterUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should assign broadcasters to a match and record audit log", async () => {
      mockPrismaService.match.findFirst
        .mockResolvedValueOnce({
          id: "m-1",
          broadcasters: [],
        })
        .mockResolvedValueOnce({
          id: "m-1",
          broadcasters: [
            { id: "mb-1", matchId: "m-1", userId: "b-1" },
            { id: "mb-2", matchId: "m-1", userId: "b-2" },
          ],
        });

      mockPrismaService.user.findMany.mockResolvedValueOnce([
        { id: "b-1" },
        { id: "b-2" },
      ]);

      const result = await service.assignBroadcasters(
        "m-1",
        ["b-1", "b-2"],
        mockUser,
      );

      expect(
        mockPrismaService.matchBroadcaster.deleteMany,
      ).toHaveBeenCalledWith({
        where: { matchId: "m-1" },
      });
      expect(
        mockPrismaService.matchBroadcaster.createMany,
      ).toHaveBeenCalledWith({
        data: [
          { matchId: "m-1", userId: "b-1", assignedByUserId: mockUser.id },
          { matchId: "m-1", userId: "b-2", assignedByUserId: mockUser.id },
        ],
      });
      expect(mockAuditLogsService.recordLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "UPDATE",
          entityType: "match_broadcasters",
          entityId: "m-1",
        }),
      );
      expect(result.id).toBe("m-1");
    });

    it("should throw BadRequestException if one or more broadcaster IDs are invalid", async () => {
      mockPrismaService.match.findFirst.mockResolvedValueOnce({
        id: "m-1",
        broadcasters: [],
      });

      mockPrismaService.user.findMany.mockResolvedValueOnce([{ id: "b-1" }]); // b-2 missing or not BROADCASTER

      await expect(
        service.assignBroadcasters("m-1", ["b-1", "b-2"], mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
