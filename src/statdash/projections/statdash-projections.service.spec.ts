import { Test, TestingModule } from "@nestjs/testing";
import { StatdashProjectionsService } from "./statdash-projections.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { QueueService } from "../../common/queue/queue.service";

describe("StatdashProjectionsService", () => {
  let service: StatdashProjectionsService;

  const prisma = {
    gameSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gameEvent: {
      findMany: jest.fn(),
    },
    projectionState: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    matchPlayer: {
      findMany: jest.fn(),
    },
    matchStat: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redisService = {
    getProjectionCached: jest.fn(),
    setProjectionCached: jest.fn(),
    invalidateProjectionCache: jest.fn(),
    invalidateSessionSnapshotCache: jest.fn(),
  };
  const queueService = {
    enqueueMatchStatSync: jest.fn(),
  };

  beforeEach(async () => {
    prisma.$transaction.mockImplementation(async (operations: unknown[]) =>
      Promise.all(operations as Promise<unknown>[]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatdashProjectionsService,
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
      ],
    }).compile();

    service = module.get<StatdashProjectionsService>(StatdashProjectionsService);
    jest.clearAllMocks();
  });

  it("replays score deterministically with correction and reversal", () => {
    const events = [
      {
        id: "e1",
        eventType: "shot",
        sequence: 1,
        payload: { result: "made", shotValue: 2, teamId: "home_team" },
      },
      {
        id: "e2",
        eventType: "correction",
        sequence: 2,
        payload: {
          targetEventId: "e1",
          correctedPayload: { result: "made", shotValue: 3, teamId: "home_team" },
        },
      },
      {
        id: "e3",
        eventType: "reversal",
        sequence: 3,
        payload: { reversedEventId: "e1" },
      },
      {
        id: "e4",
        eventType: "free_throw",
        sequence: 4,
        payload: { result: "made", teamId: "away_team" },
      },
    ];
    const resolvedEvents = service.resolveEvents(events);
    const replay = service.replayScoreFromEvents(resolvedEvents, events.length);

    expect(replay).toEqual({ homeScore: 0, awayScore: 1, version: 4 });
  });

  it("builds box score projection from events", async () => {
    prisma.projectionState.findUnique.mockResolvedValue(null);
    prisma.gameSession.findUnique.mockResolvedValue({
      id: "session_1",
      version: 2,
      homeScore: 0,
      awayScore: 0,
      match: {
        id: "match_1",
        homeTeamId: "team_a",
        awayTeamId: "team_b",
      },
    });
    prisma.$transaction.mockResolvedValue([
      { id: "session_1", version: 2, homeScore: 0, awayScore: 0 },
      { id: "proj_1" },
    ]);
    prisma.matchPlayer.findMany.mockResolvedValue([
      { playerId: "p1", teamId: "team_a" },
    ]);
    prisma.gameEvent.findMany.mockResolvedValue([
      {
        id: "e1",
        eventType: "shot",
        sequence: 1,
        payload: {
          shooterPlayerId: "p1",
          playerId: "p1",
          result: "made",
          shotValue: 2,
        },
      },
      { id: "e2", eventType: "rebound", sequence: 2, payload: { playerId: "p1" } },
    ]);

    const result = await service.getBoxScore("session_1");
    expect(result.players.p1.points).toBe(2);
    expect(result.players.p1.rebounds).toBe(1);
  });
});
