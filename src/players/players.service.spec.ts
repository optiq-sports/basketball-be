import { Test, TestingModule } from "@nestjs/testing";
import { PlayersService } from "./players.service";
import { PrismaService } from "../prisma/prisma.service";
import { PlayerDeduplicationService } from "../common/services/player-deduplication.service";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { PlayerPosition } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

describe("PlayersService", () => {
  let service: PlayersService;
  let prisma: PrismaService;
  let deduplicationService: PlayerDeduplicationService;

  const mockPrismaService = {
    player: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    playerTeam: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDeduplicationService = {
    findDuplicatePlayer: jest.fn(),
    findDuplicatesBatch: jest.fn(),
  };

  const mockAuditLogsService = {
    recordLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlayerDeduplicationService,
          useValue: mockDeduplicationService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
    prisma = module.get<PrismaService>(PrismaService);
    deduplicationService = module.get<PlayerDeduplicationService>(
      PlayerDeduplicationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new player successfully", async () => {
      const createPlayerDto = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        matchType: "NO_MATCH",
        existingPlayer: undefined,
        similarityScore: 0,
      });

      mockPrismaService.player.findUnique.mockResolvedValue(null);
      mockPrismaService.player.create.mockResolvedValue({
        id: "player1",
        ...createPlayerDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createPlayerDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.player.create).toHaveBeenCalled();
    });

    it("should throw ConflictException if duplicate player found", async () => {
      const createPlayerDto = {
        firstName: "John",
        lastName: "Doe",
      };

      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        matchType: "EXACT_MATCH",
        existingPlayer: { id: "existing1", firstName: "John", lastName: "Doe" },
        similarityScore: 98.5,
      });

      await expect(service.create(createPlayerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("createForTeam", () => {
    it("should create player and assign to team", async () => {
      const createDto = {
        teamId: "team1",
        firstName: "John",
        lastName: "Doe",
        jerseyNumber: 23,
      };

      mockPrismaService.team.findUnique.mockResolvedValue({
        id: "team1",
        name: "Lakers",
      });
      mockPrismaService.playerTeam.findFirst.mockResolvedValue(null);
      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        matchType: "NO_MATCH",
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          player: {
            create: jest.fn().mockResolvedValue({
              id: "player1",
              firstName: "John",
              lastName: "Doe",
            }),
            findUnique: jest.fn().mockResolvedValue(null),
          },
          playerTeam: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.createForTeam(createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException if team does not exist", async () => {
      const createDto = {
        teamId: "invalid",
        firstName: "John",
        lastName: "Doe",
        jerseyNumber: 23,
      };

      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.createForTeam(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("bulkCreateForTeam", () => {
    it("should create multiple players with deduplication", async () => {
      const bulkDto = {
        teamId: "team1",
        players: [
          { firstName: "John", lastName: "Doe", jerseyNumber: 23 },
          { firstName: "Jane", lastName: "Smith", jerseyNumber: 24 },
        ],
      };

      mockPrismaService.team.findUnique.mockResolvedValue({ id: "team1" });
      mockPrismaService.playerTeam.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        matchType: "NO_MATCH",
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          player: {
            create: jest.fn().mockResolvedValue({
              id: "player1",
              firstName: "John",
              lastName: "Doe",
            }),
            findUnique: jest.fn().mockResolvedValue(null),
          },
          playerTeam: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.bulkCreateForTeam(bulkDto);

      expect(result).toBeDefined();
      expect(result.created).toBeGreaterThan(0);
    });
  });

  describe("findOne", () => {
    it("should return player if found", async () => {
      const playerId = "player1";
      const mockPlayer = {
        id: playerId,
        firstName: "John",
        lastName: "Doe",
        playerTeams: [],
        matchStats: [],
      };

      mockPrismaService.player.findUnique.mockResolvedValue(mockPlayer);

      const result = await service.findOne(playerId);

      expect(result).toBeDefined();
      expect(result.id).toBe(playerId);
    });

    it("should throw NotFoundException if player not found", async () => {
      mockPrismaService.player.findUnique.mockResolvedValue(null);

      await expect(service.findOne("invalid")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("should sort by createdAt desc when sortBy=createdAt and sortOrder=desc", async () => {
      mockPrismaService.player.findMany.mockResolvedValue([
        { id: "p1", firstName: "Recent", lastName: "Player", playerTeams: [] },
      ]);
      mockPrismaService.player.count.mockResolvedValue(1);

      const result = await service.findAll({
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result.items).toHaveLength(1);
      expect(mockPrismaService.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("should default to sorting by lastName and firstName asc when no sortBy is provided", async () => {
      mockPrismaService.player.findMany.mockResolvedValue([]);
      mockPrismaService.player.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrismaService.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
      );
    });

    it("should support two-term search across firstName and lastName", async () => {
      mockPrismaService.player.findMany.mockResolvedValue([]);
      mockPrismaService.player.count.mockResolvedValue(0);

      await service.findAll({ search: "LeBron James" });

      expect(mockPrismaService.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { firstName: { contains: "LeBron", mode: "insensitive" } },
              { lastName: { contains: "James", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    it("should filter by position when position is provided", async () => {
      mockPrismaService.player.findMany.mockResolvedValue([]);
      mockPrismaService.player.count.mockResolvedValue(0);

      await service.findAll({ position: PlayerPosition.CENTER });

      expect(mockPrismaService.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            position: PlayerPosition.CENTER,
          }),
        }),
      );
      expect(mockPrismaService.player.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            position: PlayerPosition.CENTER,
          }),
        }),
      );
    });

    it("should sort by jerseyNumber via playerTeam junction table", async () => {
      const mockPlayerTeam = {
        id: "pt1",
        jerseyNumber: 23,
        teamId: "t1",
        isActive: true,
        player: {
          id: "p1",
          firstName: "Michael",
          lastName: "Jordan",
          playerTeams: [
            {
              id: "pt1",
              jerseyNumber: 23,
              teamId: "t1",
              isActive: true,
              team: { id: "t1", name: "Bulls", code: "CHI" },
            },
          ],
        },
      };

      mockPrismaService.playerTeam.findMany.mockResolvedValue([mockPlayerTeam]);
      mockPrismaService.playerTeam.count.mockResolvedValue(1);

      const result = await service.findAll({
        sortBy: "jerseyNumber",
        sortOrder: "asc",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].jerseyNumber).toBe(23);
      expect(mockPrismaService.playerTeam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { jerseyNumber: "asc" },
        }),
      );
    });

    it("should sort by teamName via playerTeam junction table", async () => {
      const mockPlayerTeam = {
        id: "pt1",
        jerseyNumber: 30,
        teamId: "t1",
        isActive: true,
        player: {
          id: "p1",
          firstName: "Stephen",
          lastName: "Curry",
          playerTeams: [
            {
              id: "pt1",
              jerseyNumber: 30,
              teamId: "t1",
              isActive: true,
              team: { id: "t1", name: "Warriors", code: "GSW" },
            },
          ],
        },
      };

      mockPrismaService.playerTeam.findMany.mockResolvedValue([mockPlayerTeam]);
      mockPrismaService.playerTeam.count.mockResolvedValue(1);

      const result = await service.findAll({
        sortBy: "teamName",
        sortOrder: "desc",
      });

      expect(result.items).toHaveLength(1);
      expect(mockPrismaService.playerTeam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { team: { name: "desc" } },
        }),
      );
    });
  });

  describe("release", () => {
    it("should deactivate active playerTeam associations and return the updated player", async () => {
      const mockPlayer = {
        id: "p1",
        firstName: "John",
        lastName: "Doe",
        playerTeams: [
          {
            id: "pt1",
            playerId: "p1",
            teamId: "t1",
            isActive: false,
            leftAt: new Date(),
            team: { id: "t1", name: "Lakers", code: "LAL" },
          },
        ],
        matchStats: [],
      };

      mockPrismaService.player.findUnique
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce(mockPlayer);
      mockPrismaService.playerTeam.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.release("p1");

      expect(mockPrismaService.playerTeam.updateMany).toHaveBeenCalledWith({
        where: { playerId: "p1", isActive: true },
        data: expect.objectContaining({ isActive: false }),
      });
      expect(result.playerTeams?.[0].isActive).toBe(false);
    });

    it("should throw NotFoundException if player to release does not exist", async () => {
      mockPrismaService.player.findUnique.mockResolvedValue(null);

      await expect(service.release("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("permanentDelete", () => {
    it("should throw ConflictException if player has match stats or appearances", async () => {
      mockPrismaService.player.findUnique.mockResolvedValue({
        id: "p1",
        _count: { matchStats: 5, matchPlayers: 3 },
      });

      await expect(service.permanentDelete("p1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("should permanently delete player and associations if no match history exists", async () => {
      mockPrismaService.player.findUnique.mockResolvedValue({
        id: "p1",
        _count: { matchStats: 0, matchPlayers: 0 },
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      const result = await service.permanentDelete("p1");

      expect(result.success).toBe(true);
      expect(mockPrismaService.playerTeam.deleteMany).toHaveBeenCalledWith({
        where: { playerId: "p1" },
      });
      expect(mockPrismaService.player.delete).toHaveBeenCalledWith({
        where: { id: "p1" },
      });
    });

    it("should throw NotFoundException on second call or if player does not exist", async () => {
      mockPrismaService.player.findUnique.mockResolvedValue(null);

      await expect(service.permanentDelete("p1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
