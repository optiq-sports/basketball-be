import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { GameSessionStatus, MatchStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { StatdashSessionsRepository } from "./statdash-sessions.repository";
import { StatdashSessionsService } from "./statdash-sessions.service";

describe("StatdashSessionsService", () => {
  let service: StatdashSessionsService;
  const repository = {
    createSession: jest.fn(),
    findSessionById: jest.fn(),
  };
  const prismaService = {
    match: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tournament: {
      findUnique: jest.fn(),
    },
    clientUser: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    gameSession: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    gameEvent: {
      findMany: jest.fn(),
    },
    lineupState: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redisService = {
    getSessionSnapshotCached: jest.fn(),
    setSessionSnapshotCached: jest.fn(),
    invalidateSessionSnapshotCache: jest.fn(),
    getRecentEventsCached: jest.fn(),
    setRecentEventsCached: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatdashSessionsService,
        {
          provide: StatdashSessionsRepository,
          useValue: repository,
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    service = module.get<StatdashSessionsService>(StatdashSessionsService);
    jest.clearAllMocks();
  });

  it("creates baseline pending session state", async () => {
    repository.createSession.mockResolvedValue({
      id: "session_1",
      matchId: "match_1",
      status: GameSessionStatus.PENDING,
    });

    await service.createSessionSeed({
      matchId: "match_1",
      homeOnLeft: true,
      homeAttacksLeft: false,
    });

    expect(repository.createSession).toHaveBeenCalledWith({
      matchId: "match_1",
      homeOnLeft: true,
      homeAttacksLeft: false,
      status: GameSessionStatus.PENDING,
    });
  });

  it("reads sessions by id", async () => {
    repository.findSessionById.mockResolvedValue({
      id: "session_1",
      matchId: "match_1",
    });

    const result = await service.getSessionById("session_1");

    expect(repository.findSessionById).toHaveBeenCalledWith("session_1");
    expect(result).toEqual({
      id: "session_1",
      matchId: "match_1",
    });
  });

  it("resolves match key with existing session", async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: "match_1",
      status: MatchStatus.LIVE,
      gameSessions: { id: "session_1", status: GameSessionStatus.IN_PROGRESS },
    });

    const result = await service.resolveMatchKey("match_1");
    expect(result).toEqual({
      matchId: "match_1",
      matchStatus: MatchStatus.LIVE,
      sessionId: "session_1",
      sessionStatus: GameSessionStatus.IN_PROGRESS,
    });
  });

  it("rejects tournament code as match key", async () => {
    prismaService.match.findFirst.mockResolvedValue(null);
    prismaService.tournament.findUnique.mockResolvedValue({
      id: "tourney_1",
      code: "TOURNAMENT_KEY",
    });

    await expect(service.resolveMatchKey("TOURNAMENT_KEY")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws NotFoundException when match key is not found", async () => {
    prismaService.match.findFirst.mockResolvedValue(null);
    prismaService.tournament.findUnique.mockResolvedValue(null);

    await expect(service.resolveMatchKey("UNKNOWN_KEY")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws ForbiddenException when match is assigned to another statistician", async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: "match_1",
      statisticianId: "other_stat_id",
      status: MatchStatus.SCHEDULED,
      gameSessions: null,
    });

    await expect(
      service.resolveMatchKey("MATCH_KEY", "current_stat_id"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows access when match is assigned to the current statistician", async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: "match_1",
      statisticianId: "current_stat_id",
      status: MatchStatus.SCHEDULED,
      gameSessions: null,
    });

    const result = await service.resolveMatchKey(
      "MATCH_KEY",
      "current_stat_id",
    );
    expect(result.matchId).toBe("match_1");
  });

  it("allows access when match is unassigned (statisticianId is null)", async () => {
    prismaService.match.findFirst.mockResolvedValue({
      id: "match_1",
      statisticianId: null,
      status: MatchStatus.SCHEDULED,
      gameSessions: null,
    });

    const result = await service.resolveMatchKey(
      "MATCH_KEY",
      "current_stat_id",
    );
    expect(result.matchId).toBe("match_1");
  });

  it("throws BadRequestException when match key is blank", async () => {
    await expect(service.resolveMatchKey("   ")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("fails bootstrap when neither matchId nor sessionId is provided", async () => {
    await expect(service.bootstrap({})).rejects.toThrow(BadRequestException);
  });

  it("bootstraps session using matchKey and claims unassigned match for statistician", async () => {
    redisService.getSessionSnapshotCached.mockResolvedValue(null);
    prismaService.match.findFirst.mockResolvedValue({
      id: "match_cuid_1",
      matchKey: "MATCH123",
      statisticianId: null,
      homeScore: 0,
      awayScore: 0,
    });
    prismaService.match.update.mockResolvedValue({
      id: "match_cuid_1",
      statisticianId: "stat_irene",
    });
    prismaService.gameSession.upsert.mockResolvedValue({
      id: "session_1",
      matchId: "match_cuid_1",
      homeScore: 0,
      awayScore: 0,
      status: GameSessionStatus.PENDING,
      match: {
        id: "match_cuid_1",
        statisticianId: "stat_irene",
      },
    });
    redisService.getRecentEventsCached.mockResolvedValue([]);
    prismaService.gameEvent.findMany.mockResolvedValue([]);
    prismaService.lineupState.findFirst.mockResolvedValue(null);

    const result = await service.bootstrap(
      { matchId: "MATCH123" },
      "stat_irene",
    );

    expect(prismaService.match.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: "MATCH123" },
          { matchKey: { equals: "MATCH123", mode: "insensitive" } },
        ],
      },
    });
    expect(prismaService.match.update).toHaveBeenCalledWith({
      where: { id: "match_cuid_1" },
      data: { statisticianId: "stat_irene" },
    });
    expect(prismaService.gameSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { matchId: "match_cuid_1" },
      }),
    );
    expect(result.sessionId).toBe("session_1");
  });

  it("rejects bootstrap when match is assigned to another statistician", async () => {
    redisService.getSessionSnapshotCached.mockResolvedValue(null);
    prismaService.match.findFirst.mockResolvedValue({
      id: "match_cuid_2",
      statisticianId: "other_stat",
      homeScore: 0,
      awayScore: 0,
    });

    await expect(
      service.bootstrap({ matchId: "match_cuid_2" }, "stat_irene"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("claims unassigned match when bootstrapping by sessionId for statistician", async () => {
    redisService.getSessionSnapshotCached.mockResolvedValue(null);
    prismaService.clientUser.findMany.mockResolvedValueOnce([
      { clientId: "client_kaduna" },
    ]);
    prismaService.gameSession.findUnique.mockResolvedValue({
      id: "session_2",
      matchId: "match_cuid_3",
      homeScore: 10,
      awayScore: 12,
      status: GameSessionStatus.IN_PROGRESS,
      match: {
        id: "match_cuid_3",
        clientId: "client_kaduna",
        statisticianId: null,
      },
    });
    prismaService.match.update.mockResolvedValue({
      id: "match_cuid_3",
      statisticianId: "stat_irene",
    });
    redisService.getRecentEventsCached.mockResolvedValue([]);
    prismaService.gameEvent.findMany.mockResolvedValue([]);
    prismaService.lineupState.findFirst.mockResolvedValue(null);

    const result = await service.bootstrap(
      { sessionId: "session_2" },
      "stat_irene",
    );

    expect(prismaService.match.update).toHaveBeenCalledWith({
      where: { id: "match_cuid_3" },
      data: { statisticianId: "stat_irene" },
    });
    expect(result.sessionId).toBe("session_2");
  });

  it("refuses to bootstrap/claim unassigned match by id for statistician outside client", async () => {
    redisService.getSessionSnapshotCached.mockResolvedValue(null);
    prismaService.gameSession.findUnique.mockResolvedValue(null);
    prismaService.match.findFirst.mockResolvedValueOnce({
      id: "match_cuid_foreign",
      matchKey: "KEY12345",
      clientId: "client_foreign",
      statisticianId: null,
      homeScore: 0,
      awayScore: 0,
    });
    prismaService.clientUser.findMany.mockResolvedValueOnce([]);

    await expect(
      service.bootstrap({ matchId: "match_cuid_foreign" }, "stat_outside"),
    ).rejects.toThrow(NotFoundException);
  });

  it("starts a pending session", async () => {
    prismaService.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      status: GameSessionStatus.PENDING,
      startedAt: null,
    });
    prismaService.$transaction = jest.fn().mockResolvedValue([
      {
        id: "session_1",
        status: GameSessionStatus.IN_PROGRESS,
      },
    ]);

    const result = await service.startSession("session_1");
    expect(result).toEqual({
      id: "session_1",
      status: GameSessionStatus.IN_PROGRESS,
    });
    expect(prismaService.$transaction).toHaveBeenCalled();
  });

  it("rejects start for completed sessions", async () => {
    prismaService.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      status: GameSessionStatus.COMPLETED,
      startedAt: new Date(),
    });

    await expect(service.startSession("session_1")).rejects.toThrow(
      ConflictException,
    );
  });

  it("fails with not found for unknown session start", async () => {
    prismaService.gameSession.findUnique.mockResolvedValue(null);
    await expect(service.startSession("missing_session")).rejects.toThrow(
      NotFoundException,
    );
  });

  describe("state transitions", () => {
    it("pauses an in-progress session", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({
        id: "session_1",
        status: GameSessionStatus.IN_PROGRESS,
      });
      prismaService.gameSession.update.mockResolvedValue({
        id: "session_1",
        status: GameSessionStatus.PAUSED,
      });

      const result = await service.pauseSession("session_1");
      expect(result.status).toBe(GameSessionStatus.PAUSED);
    });

    it("rejects pause for non-in-progress session", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({
        id: "session_1",
        status: GameSessionStatus.PENDING,
      });
      await expect(service.pauseSession("session_1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("completes a session and its match", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({
        id: "session_1",
        status: GameSessionStatus.IN_PROGRESS,
        matchId: "match_1",
      });
      prismaService.$transaction = jest
        .fn()
        .mockResolvedValue([
          { id: "session_1", status: GameSessionStatus.COMPLETED },
        ]);

      const result = await service.completeSession("session_1");
      expect(result.status).toBe(GameSessionStatus.COMPLETED);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("rejects complete for already completed session", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({
        id: "session_1",
        status: GameSessionStatus.COMPLETED,
      });
      await expect(service.completeSession("session_1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("cancels a session and its match", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({
        id: "session_1",
        status: GameSessionStatus.IN_PROGRESS,
        matchId: "match_1",
      });
      prismaService.$transaction = jest
        .fn()
        .mockResolvedValue([
          { id: "session_1", status: GameSessionStatus.CANCELLED },
        ]);

      const result = await service.cancelSession("session_1");
      expect(result.status).toBe(GameSessionStatus.CANCELLED);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });
});
