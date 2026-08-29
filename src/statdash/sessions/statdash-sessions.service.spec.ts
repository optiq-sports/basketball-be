import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
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
      findMany: jest.fn(),
      update: jest.fn(),
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
    prismaService.match.findUnique.mockResolvedValue({
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

  it("fails resolve when tournament key maps to multiple matches", async () => {
    prismaService.match.findUnique.mockResolvedValue(null);
    prismaService.match.findMany.mockResolvedValue([
      { id: "m1", status: MatchStatus.SCHEDULED, gameSessions: null },
      { id: "m2", status: MatchStatus.SCHEDULED, gameSessions: null },
    ]);

    await expect(service.resolveMatchKey("TOURNAMENT_KEY")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("fails bootstrap when neither matchId nor sessionId is provided", async () => {
    await expect(service.bootstrap({})).rejects.toThrow(BadRequestException);
  });

  it("starts a pending session", async () => {
    prismaService.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      status: GameSessionStatus.PENDING,
      startedAt: null,
    });
    prismaService.$transaction = jest.fn().mockResolvedValue([{
      id: "session_1",
      status: GameSessionStatus.IN_PROGRESS,
    }]);

    const result = await service.startSession("session_1");
    expect(result).toEqual({ id: "session_1", status: GameSessionStatus.IN_PROGRESS });
    expect(prismaService.$transaction).toHaveBeenCalled();
  });

  it("rejects start for completed sessions", async () => {
    prismaService.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      status: GameSessionStatus.COMPLETED,
      startedAt: new Date(),
    });

    await expect(service.startSession("session_1")).rejects.toThrow(ConflictException);
  });

  it("fails with not found for unknown session start", async () => {
    prismaService.gameSession.findUnique.mockResolvedValue(null);
    await expect(service.startSession("missing_session")).rejects.toThrow(NotFoundException);
  });

  describe("state transitions", () => {
    it("pauses an in-progress session", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({ id: "session_1", status: GameSessionStatus.IN_PROGRESS });
      prismaService.gameSession.update.mockResolvedValue({ id: "session_1", status: GameSessionStatus.PAUSED });

      const result = await service.pauseSession("session_1");
      expect(result.status).toBe(GameSessionStatus.PAUSED);
    });

    it("rejects pause for non-in-progress session", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({ id: "session_1", status: GameSessionStatus.PENDING });
      await expect(service.pauseSession("session_1")).rejects.toThrow(ConflictException);
    });

    it("completes a session and its match", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({ id: "session_1", status: GameSessionStatus.IN_PROGRESS, matchId: "match_1" });
      prismaService.$transaction = jest.fn().mockResolvedValue([{ id: "session_1", status: GameSessionStatus.COMPLETED }]);

      const result = await service.completeSession("session_1");
      expect(result.status).toBe(GameSessionStatus.COMPLETED);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("rejects complete for already completed session", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({ id: "session_1", status: GameSessionStatus.COMPLETED });
      await expect(service.completeSession("session_1")).rejects.toThrow(ConflictException);
    });

    it("cancels a session and its match", async () => {
      prismaService.gameSession.findUnique.mockResolvedValue({ id: "session_1", status: GameSessionStatus.IN_PROGRESS, matchId: "match_1" });
      prismaService.$transaction = jest.fn().mockResolvedValue([{ id: "session_1", status: GameSessionStatus.CANCELLED }]);

      const result = await service.cancelSession("session_1");
      expect(result.status).toBe(GameSessionStatus.CANCELLED);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });
});
