import { ConflictException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { StatdashEventsService } from "./statdash-events.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { QueueService } from "../../common/queue/queue.service";
import { StatdashProjectionsService } from "../projections/statdash-projections.service";
import { StatdashRealtimeService } from "../realtime/statdash-realtime.service";

describe("StatdashEventsService", () => {
  let service: StatdashEventsService;

  const tx = {
    gameSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    idempotencyRecord: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    lineupState: {
      findFirst: jest.fn(),
    },
    gameEvent: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const projectionsService = {
    resolveEvents: jest.fn().mockImplementation((events) => events),
    replayScoreFromEvents: jest.fn().mockReturnValue({
      homeScore: 12,
      awayScore: 9,
      version: 4,
    }),
  };
  const redisService = {
    getIdempotencyResultCached: jest.fn(),
    setIdempotencyResultCached: jest.fn(),
    acquireSessionLock: jest.fn().mockResolvedValue(true),
    releaseSessionLock: jest.fn(),
    invalidateSessionSnapshotCache: jest.fn(),
    invalidateProjectionCache: jest.fn(),
    appendRecentEventCache: jest.fn(),
  };
  const queueService = {
    enqueueProjectionRebuild: jest.fn(),
    enqueueMatchStatSync: jest.fn(),
    enqueueCorrectionRecompute: jest.fn(),
  };
  const realtimeService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatdashEventsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
        {
          provide: StatdashProjectionsService,
          useValue: projectionsService,
        },
        {
          provide: StatdashRealtimeService,
          useValue: realtimeService,
        },
      ],
    }).compile();

    service = module.get<StatdashEventsService>(StatdashEventsService);
    jest.clearAllMocks();
  });

  it("returns cached response for duplicate idempotency key", async () => {
    redisService.getIdempotencyResultCached.mockResolvedValue(null);
    tx.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      matchId: "match_1",
      version: 2,
      homeScore: 10,
      awayScore: 8,
      match: { homeTeamId: "home", awayTeamId: "away" },
    });
    tx.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: null,
      responseSnapshot: { sessionId: "session_1", version: 3 },
    });

    const result = await service.handleCommand(
      {
        sessionId: "session_1",
        commandType: "shot",
        payload: {
          teamId: "home",
          shooterPlayerId: "p1",
          shotValue: 2,
          result: "made",
        },
        expectedVersion: 2,
        idempotencyKey: "idem_1",
      },
      "actor_1",
    );

    expect(result).toEqual({ sessionId: "session_1", version: 3 });
    expect(tx.gameEvent.create).not.toHaveBeenCalled();
    expect(realtimeService.publish).not.toHaveBeenCalled();
  });

  it("rejects stale versions with conflict response", async () => {
    redisService.getIdempotencyResultCached.mockResolvedValue(null);
    tx.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      matchId: "match_1",
      version: 5,
      homeScore: 10,
      awayScore: 8,
      match: { homeTeamId: "home", awayTeamId: "away" },
    });
    tx.idempotencyRecord.findUnique.mockResolvedValue(null);

    await expect(
      service.handleCommand(
        {
          sessionId: "session_1",
          commandType: "shot",
          payload: {
            teamId: "home",
            shooterPlayerId: "p1",
            shotValue: 2,
            result: "made",
          },
          expectedVersion: 2,
          idempotencyKey: "idem_1",
        },
        "actor_1",
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("rejects idempotency key reuse with different request hash", async () => {
    redisService.getIdempotencyResultCached.mockResolvedValue({
      requestHash: "different_hash",
      response: { sessionId: "session_1", version: 3 },
    });

    await expect(
      service.handleCommand(
        {
          sessionId: "session_1",
          commandType: "shot",
          payload: {
            teamId: "home",
            shooterPlayerId: "p1",
            shotValue: 2,
            result: "made",
          },
          expectedVersion: 2,
          idempotencyKey: "idem_1",
        },
        "actor_1",
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("publishes realtime update after successful command", async () => {
    redisService.getIdempotencyResultCached.mockResolvedValue(null);
    tx.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      matchId: "match_1",
      version: 2,
      homeScore: 10,
      awayScore: 8,
      match: { homeTeamId: "home", awayTeamId: "away" },
    });
    tx.idempotencyRecord.findUnique.mockResolvedValue(null);
    tx.lineupState.findFirst.mockResolvedValue(null);
    tx.gameEvent.aggregate.mockResolvedValue({ _max: { sequence: 10 } });
    tx.gameEvent.create.mockResolvedValue({
      id: "ge1",
      sequence: 11,
      eventType: "shot",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    tx.gameSession.update.mockResolvedValue({
      id: "session_1",
      version: 3,
      homeScore: 12,
      awayScore: 8,
    });
    tx.idempotencyRecord.create.mockResolvedValue({});

    const result = await service.handleCommand(
      {
        sessionId: "session_1",
        commandType: "shot",
        payload: {
          teamId: "home",
          shooterPlayerId: "p1",
          shotValue: 2,
          result: "made",
        },
        expectedVersion: 2,
        idempotencyKey: "idem_ok",
      },
      "actor_1",
    );

    expect(result).toEqual({
      sessionId: "session_1",
      version: 3,
      score: { home: 12, away: 8 },
      emittedEvents: [
        {
          id: "ge1",
          sequence: 11,
          eventType: "shot",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    expect(realtimeService.publish).toHaveBeenCalledWith({
      sessionId: "session_1",
      source: "command",
      state: { version: 3, score: { home: 12, away: 8 } },
      deltaEvents: [
        {
          id: "ge1",
          sequence: 11,
          eventType: "shot",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
  });

  it("creates correction event and recomputes state", async () => {
    redisService.getIdempotencyResultCached.mockResolvedValue(null);
    tx.gameEvent.findUnique.mockResolvedValue({
      id: "e1",
      sessionId: "session_1",
      eventType: "shot",
      resultingVersion: 2,
    });
    tx.gameEvent.aggregate.mockResolvedValue({ _max: { sequence: 2 } });
    tx.gameEvent.create.mockResolvedValue({});
    tx.gameEvent.findMany.mockResolvedValue([
      { id: "e1", eventType: "shot", payload: { result: "made", shotValue: 2 } },
      { id: "e2", eventType: "correction", payload: { targetEventId: "e1" } },
    ]);
    tx.gameSession.update.mockResolvedValue({
      id: "session_1",
      version: 4,
      homeScore: 12,
      awayScore: 9,
    });

    const result = await service.correctEvent(
      "e1",
      { reason: "fix shooter", correctedPayload: { shotValue: 3, result: "made" } },
      "actor_1",
    );

    expect(result).toEqual({
      sessionId: "session_1",
      version: 4,
      score: { home: 12, away: 9 },
      correctedEventId: "e1",
    });
    expect(realtimeService.publish).toHaveBeenCalledWith({
      sessionId: "session_1",
      source: "correction",
      state: { version: 4, score: { home: 12, away: 9 } },
      deltaEvents: [{ eventType: "correction" }],
    });
  });

  it("creates reversal event and recomputes state", async () => {
    redisService.getIdempotencyResultCached.mockResolvedValue(null);
    tx.gameEvent.findUnique.mockResolvedValue({
      id: "e10",
      sessionId: "session_1",
      eventType: "free_throw",
      resultingVersion: 2,
    });
    tx.gameEvent.aggregate.mockResolvedValue({ _max: { sequence: 3 } });
    tx.gameEvent.create.mockResolvedValue({});
    tx.gameEvent.findMany.mockResolvedValue([
      { id: "e10", eventType: "free_throw", payload: { result: "made" } },
      { id: "e11", eventType: "reversal", payload: { reversedEventId: "e10" } },
    ]);
    tx.gameSession.update.mockResolvedValue({
      id: "session_1",
      version: 4,
      homeScore: 12,
      awayScore: 9,
    });

    const result = await service.reverseEvent(
      "e10",
      { reason: "erroneous FT" },
      "actor_1",
    );

    expect(result).toEqual({
      sessionId: "session_1",
      version: 4,
      score: { home: 12, away: 9 },
      reversedEventId: "e10",
    });
    expect(realtimeService.publish).toHaveBeenCalledWith({
      sessionId: "session_1",
      source: "reversal",
      state: { version: 4, score: { home: 12, away: 9 } },
      deltaEvents: [{ eventType: "reversal" }],
    });
  });
});
