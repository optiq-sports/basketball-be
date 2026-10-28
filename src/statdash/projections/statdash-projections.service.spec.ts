import { Test, TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";
import { StatdashProjectionsService } from "./statdash-projections.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { QueueService } from "../../common/queue/queue.service";
import type { AuthenticatedUser } from "../../common/interfaces/user.interface";

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
    match: {
      update: jest.fn(),
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

    service = module.get<StatdashProjectionsService>(
      StatdashProjectionsService,
    );
    jest.clearAllMocks();
  });

  it("replays score deterministically with correction and reversal", () => {
    const events = [
      {
        id: "e1",
        eventType: "shot",
        sequence: 1,
        payload: { shot: { result: "made", value: 2 }, teamId: "home_team" },
      },
      {
        id: "e2",
        eventType: "correction",
        sequence: 2,
        payload: {
          targetEventId: "e1",
          correctedPayload: {
            shot: { result: "made", value: 3 },
            teamId: "home_team",
          },
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

    expect(replay).toEqual({
      homeScore: 0,
      awayScore: 1,
      quarter: 1,
      clockSecondsRemaining: 600,
      possessionTeamId: null,
      jumpBallWinnerTeamId: null,
      version: 4,
      homeLineup: [],
      awayLineup: [],
      quarter1Home: 0,
      quarter1Away: 1,
      quarter2Home: 0,
      quarter2Away: 0,
      quarter3Home: 0,
      quarter3Away: 0,
      quarter4Home: 0,
      quarter4Away: 0,
      overtimeHome: 0,
      overtimeAway: 0,
    });
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
          shot: { result: "made", value: 2 },
        },
      },
      {
        id: "e2",
        eventType: "rebound",
        sequence: 2,
        payload: { reboundPlayerId: "p1" },
      },
    ]);

    const result = await service.getBoxScore("session_1");
    expect(result.players.p1.points).toBe(2);
    expect(result.players.p1.rebounds).toBe(1);
  });

  it("calculates secondsPlayed from substitution events against the game clock and ensures starters have non-zero minutes", () => {
    const events = [
      {
        id: "e1",
        eventType: "substitution",
        sequence: 1,
        payload: {
          homeLineup: ["h1", "h2", "h3", "h4", "h5"],
          awayLineup: ["a1", "a2", "a3", "a4", "a5"],
          period: 1,
          clockSecondsRemaining: 600,
        },
      },
      {
        id: "e2",
        eventType: "shot",
        sequence: 2,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "h1",
          playerId: "h1",
          shot: { result: "made", value: 2 },
          period: 1,
          clockSecondsRemaining: 480, // 120 seconds elapsed
        },
      },
      {
        id: "e3",
        eventType: "substitution",
        sequence: 3,
        payload: {
          teamId: "home_team",
          playerOutId: "h1",
          playerInId: "h6",
          period: 1,
          clockSecondsRemaining: 480,
        },
      },
      {
        id: "e4",
        eventType: "shot",
        sequence: 4,
        payload: {
          teamId: "away_team",
          shooterPlayerId: "a1",
          playerId: "a1",
          shot: { result: "made", value: 3 },
          period: 1,
          clockSecondsRemaining: 360, // another 120 seconds elapsed
        },
      },
    ];

    const boxScore = service.buildBoxScoreFromEvents(events, events.length, {
      homeTeamId: "home_team",
      awayTeamId: "away_team",
    });

    // Starters h2, h3, h4, h5 played 240 seconds
    expect(boxScore.players.h2.secondsPlayed).toBe(240);
    expect(boxScore.players.h3.secondsPlayed).toBe(240);
    expect(boxScore.players.h4.secondsPlayed).toBe(240);
    expect(boxScore.players.h5.secondsPlayed).toBe(240);

    // Starter h1 was subbed out at 480s, so played 120 seconds (not 0)
    expect(boxScore.players.h1.secondsPlayed).toBe(120);

    // Bench h6 came in at 480s and played until 360s, so played 120 seconds
    expect(boxScore.players.h6.secondsPlayed).toBe(120);

    // All away starters played 240 seconds
    for (const aId of ["a1", "a2", "a3", "a4", "a5"]) {
      expect(boxScore.players[aId].secondsPlayed).toBe(240);
    }

    // 240 seconds total elapsed clock * 5 players per team = 1200 seconds per team
    const totalHomeSeconds = ["h1", "h2", "h3", "h4", "h5", "h6"].reduce(
      (sum, id) => sum + boxScore.players[id].secondsPlayed,
      0,
    );
    expect(totalHomeSeconds).toBe(1200);

    const totalAwaySeconds = ["a1", "a2", "a3", "a4", "a5"].reduce(
      (sum, id) => sum + boxScore.players[id].secondsPlayed,
      0,
    );
    expect(totalAwaySeconds).toBe(1200);
  });

  it("calculates plusMinus from scoring events across on-court lineups and sums to zero across all ten players", () => {
    const events = [
      {
        id: "e1",
        eventType: "substitution",
        sequence: 1,
        payload: {
          homeLineup: ["h1", "h2", "h3", "h4", "h5"],
          awayLineup: ["a1", "a2", "a3", "a4", "a5"],
          period: 1,
          clockSecondsRemaining: 600,
        },
      },
      {
        id: "e2",
        eventType: "shot",
        sequence: 2,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "h1",
          playerId: "h1",
          shot: { result: "made", value: 3 },
          period: 1,
          clockSecondsRemaining: 570,
        },
      },
      {
        id: "e3",
        eventType: "free_throw",
        sequence: 3,
        payload: {
          teamId: "away_team",
          shooterPlayerId: "a1",
          playerId: "a1",
          result: "made",
          attempt: 1,
          totalAttempts: 1,
          period: 1,
          clockSecondsRemaining: 550,
        },
      },
    ];

    const boxScore = service.buildBoxScoreFromEvents(events, events.length, {
      homeTeamId: "home_team",
      awayTeamId: "away_team",
    });

    // Home scored +3 then conceded -1 => net +2
    for (const hId of ["h1", "h2", "h3", "h4", "h5"]) {
      expect(boxScore.players[hId].plusMinus).toBe(2);
    }

    // Away conceded -3 then scored +1 => net -2
    for (const aId of ["a1", "a2", "a3", "a4", "a5"]) {
      expect(boxScore.players[aId].plusMinus).toBe(-2);
    }

    // Sum across all 10 players on court is 5*(+2) + 5*(-2) = 0
    const allTenPlusMinus = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "a1",
      "a2",
      "a3",
      "a4",
      "a5",
    ].reduce((sum, id) => sum + boxScore.players[id].plusMinus, 0);
    expect(allTenPlusMinus).toBe(0);
  });

  it("counts assists from both standalone assist events and assists on made free throws", () => {
    const events = [
      {
        id: "e1",
        eventType: "free_throw",
        sequence: 1,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "h1",
          playerId: "h1",
          result: "made",
          attempt: 1,
          totalAttempts: 1,
          assistPlayerId: "h2", // Assist on made free throw
        },
      },
      {
        id: "e2",
        eventType: "assist",
        sequence: 2,
        payload: {
          teamId: "home_team",
          assistPlayerId: "h3", // Standalone assist event
        },
      },
    ];

    const boxScore = service.buildBoxScoreFromEvents(events, events.length, {
      homeTeamId: "home_team",
      awayTeamId: "away_team",
    });

    expect(boxScore.players.h2.assists).toBe(1);
    expect(boxScore.players.h3.assists).toBe(1);
    expect(boxScore.totals.assists).toBe(2);
  });

  it("getTimeline returns running score, descriptions, top-level teamId/playerId, and period_end/game_end rows", async () => {
    redisService.getProjectionCached.mockResolvedValue(null);

    const mockEvents = [
      {
        id: "e1",
        sequence: 1,
        eventType: "shot",
        period: 1,
        clockSecondsRemaining: 590,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "p1",
          shot: { value: 2, result: "made", type: "jumpshot" },
        },
      },
      {
        id: "e2",
        sequence: 2,
        eventType: "rebound",
        period: 1,
        clockSecondsRemaining: 570,
        payload: {
          teamId: "away_team",
          reboundPlayerId: "p2",
          rebound: { type: "offensive" },
        },
      },
      {
        id: "e3",
        sequence: 3,
        eventType: "free_throw",
        period: 1,
        clockSecondsRemaining: 550,
        payload: {
          teamId: "away_team",
          shooterPlayerId: "p2",
          attempt: 2,
          totalAttempts: 2,
          result: "missed",
        },
      },
      {
        id: "e4",
        sequence: 4,
        eventType: "shot",
        period: 2,
        clockSecondsRemaining: 580,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "p1",
          shot: { value: 3, result: "made", type: "jumpshot" },
        },
      },
    ];

    prisma.gameEvent.findMany.mockResolvedValue(mockEvents);
    prisma.gameSession.findUnique.mockResolvedValue({
      id: "s1",
      status: "FINISHED",
      match: {
        id: "m1",
        homeTeamId: "home_team",
        awayTeamId: "away_team",
        status: "COMPLETED",
      },
    });

    const timeline = (await service.getTimeline("s1")) as Array<
      Record<string, unknown>
    >;

    expect(timeline.length).toBeGreaterThan(mockEvents.length);

    // Check first event
    const firstRow = timeline[0];
    expect(firstRow.id).toBe("e1");
    expect(firstRow.teamId).toBe("home_team");
    expect(firstRow.playerId).toBe("p1");
    expect(firstRow.description).toBe("made 2-point jumpshot");
    expect(firstRow.homeScore).toBe(2);
    expect(firstRow.awayScore).toBe(0);

    // Check second event (rebound)
    const reboundRow = timeline[1];
    expect(reboundRow.description).toBe("offensive rebound");
    expect(reboundRow.playerId).toBe("p2");

    // Check third event (free throw missed)
    const ftRow = timeline[2];
    expect(ftRow.description).toBe("2nd of 2 free throws missed");

    // Check period_end row for Q1
    const periodEndQ1 = timeline.find(
      (r) => r.eventType === "period_end" && r.period === 1,
    );
    expect(periodEndQ1).toBeDefined();
    expect(periodEndQ1?.description).toBe("END OF PERIOD");
    expect(periodEndQ1?.homeScore).toBe(2);
    expect(periodEndQ1?.awayScore).toBe(0);

    // Check last row is game_end and has final score
    const lastRow = timeline[timeline.length - 1];
    expect(lastRow.eventType).toBe("game_end");
    expect(lastRow.description).toBe("END OF GAME");
    expect(lastRow.homeScore).toBe(5); // 2 + 3
    expect(lastRow.awayScore).toBe(0);
  });

  it("populates player teamId and computes per-team totals for box score projections", () => {
    const events = [
      {
        id: "e1",
        eventType: "shot",
        sequence: 1,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "p_home_1",
          shot: { result: "made", value: 3 },
          period: 1,
        },
      },
      {
        id: "e2",
        eventType: "shot",
        sequence: 2,
        payload: {
          teamId: "away_team",
          shooterPlayerId: "p_away_1",
          shot: { result: "made", value: 2 },
          period: 1,
        },
      },
      {
        id: "e3",
        eventType: "rebound",
        sequence: 3,
        payload: {
          teamId: "home_team",
          playerId: "p_home_2",
          type: "defensive",
          period: 1,
        },
      },
    ];

    const boxScore = service.buildBoxScoreFromEvents(events, events.length, {
      homeTeamId: "home_team",
      awayTeamId: "away_team",
    });

    expect(boxScore.players.p_home_1.teamId).toBe("home_team");
    expect(boxScore.players.p_away_1.teamId).toBe("away_team");
    expect(boxScore.players.p_home_2.teamId).toBe("home_team");

    expect(boxScore.teamTotals).toBeDefined();
    expect(boxScore.teamTotals?.home_team.points).toBe(3);
    expect(boxScore.teamTotals?.home_team.rebounds).toBe(1);
    expect(boxScore.teamTotals?.home.points).toBe(3);

    expect(boxScore.teamTotals?.away_team.points).toBe(2);
    expect(boxScore.teamTotals?.away.points).toBe(2);

    expect(boxScore.totals.points).toBe(5);
    expect(boxScore.totals.rebounds).toBe(1);
  });

  describe("broadcaster session access in projections", () => {
    it("should allow getBoxScore when broadcaster is assigned to the match", async () => {
      prisma.gameSession.findUnique.mockResolvedValueOnce({
        id: "sess_1",
        match: {
          clientId: "client_1",
          broadcasters: [{ userId: "b_1" }],
        },
      });

      redisService.getProjectionCached.mockResolvedValueOnce({
        totals: { points: 10 },
      });

      const user = {
        id: "b_1",
        email: "b@test.com",
        name: "Broadcaster",
        role: "BROADCASTER" as any,
      };

      const result = await service.getBoxScore("sess_1", user);
      expect(result).toEqual({ totals: { points: 10 } });
    });

    it("should throw NotFoundException when broadcaster is not assigned to the match", async () => {
      prisma.gameSession.findUnique.mockResolvedValueOnce({
        id: "sess_1",
        match: {
          clientId: "client_1",
          broadcasters: [{ userId: "other_broadcaster" }],
        },
      });

      const user = {
        id: "b_1",
        email: "b@test.com",
        name: "Broadcaster",
        role: "BROADCASTER" as any,
      };

      await expect(service.getBoxScore("sess_1", user)).rejects.toThrow();
    });
  });

  describe("substitution minutes and +/- calculation (Item 39)", () => {
    const makeGameEvents = () => [
      {
        id: "e1",
        eventType: "substitution",
        sequence: 1,
        period: 1,
        clockSecondsRemaining: 600,
        payload: {
          homeLineup: ["starter1", "h2", "h3", "h4", "h5"],
          awayLineup: ["a1", "a2", "a3", "a4", "a5"],
          period: 1,
          clockSecondsRemaining: 600,
        },
      },
      {
        id: "e2",
        eventType: "shot",
        sequence: 2,
        period: 1,
        clockSecondsRemaining: 0,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "h2",
          playerId: "h2",
          shot: { result: "made", value: 2 },
          period: 1,
          clockSecondsRemaining: 0,
        },
      },
      {
        id: "e3",
        eventType: "substitution",
        sequence: 3,
        period: 2,
        clockSecondsRemaining: 600,
        payload: {
          teamId: "home_team",
          playerOutId: "starter1",
          playerInId: "sub1",
          homeLineup: ["sub1", "h2", "h3", "h4", "h5"],
          awayLineup: ["a1", "a2", "a3", "a4", "a5"],
          period: 2,
          clockSecondsRemaining: 600,
        },
      },
      {
        id: "e4",
        eventType: "shot",
        sequence: 4,
        period: 2,
        clockSecondsRemaining: 0,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "h2",
          playerId: "h2",
          shot: { result: "made", value: 2 },
          period: 2,
          clockSecondsRemaining: 0,
        },
      },
      {
        id: "e5",
        eventType: "shot",
        sequence: 5,
        period: 3,
        clockSecondsRemaining: 0,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "h2",
          playerId: "h2",
          shot: { result: "made", value: 2 },
          period: 3,
          clockSecondsRemaining: 0,
        },
      },
      {
        id: "e6",
        eventType: "shot",
        sequence: 6,
        period: 4,
        clockSecondsRemaining: 0,
        payload: {
          teamId: "home_team",
          shooterPlayerId: "h2",
          playerId: "h2",
          shot: { result: "made", value: 2 },
          period: 4,
          clockSecondsRemaining: 0,
        },
      },
    ];

    it("ensures starter shows 10 minutes and substitute shows 30 minutes both before and after replayScoreFromEvents", () => {
      const events = makeGameEvents();
      const teamContext = { homeTeamId: "home_team", awayTeamId: "away_team" };

      // 1. Box score built alone
      const boxScoreBefore = service.buildBoxScoreFromEvents(
        events,
        events.length,
        teamContext,
      );

      // Starter played 10 minutes (600s), substitute played 30 minutes (1800s)
      expect(boxScoreBefore.players.starter1.secondsPlayed).toBe(600);
      expect(boxScoreBefore.players.sub1.secondsPlayed).toBe(1800);

      // 2. Replay score run first (as rebuild runs), then build box score
      service.replayScoreFromEvents(events, events.length, teamContext);

      // Verify that replayScoreFromEvents did NOT mutate the original lineup array in event 1 payload
      expect(
        (events[0].payload as { homeLineup: string[] }).homeLineup,
      ).toEqual(["starter1", "h2", "h3", "h4", "h5"]);

      const boxScoreAfter = service.buildBoxScoreFromEvents(
        events,
        events.length,
        teamContext,
      );

      // Starter STILL shows 10 minutes (600s) and substitute STILL shows 30 minutes (1800s)
      expect(boxScoreAfter.players.starter1.secondsPlayed).toBe(600);
      expect(boxScoreAfter.players.sub1.secondsPlayed).toBe(1800);

      // Check plus/minus: made shots were 2 in Q1, 2 in Q2, 2 in Q3, 2 in Q4 (+8 total for on-court home players)
      // Starter was only on court for Q1 shot -> +2
      expect(boxScoreAfter.players.starter1.plusMinus).toBe(2);
      // Sub was on court for Q2, Q3, Q4 shots -> +6 (not doubled to +12 or +20)
      expect(boxScoreAfter.players.sub1.plusMinus).toBe(6);
      // Other home starters on court for all 4 shots -> +8
      expect(boxScoreAfter.players.h2.plusMinus).toBe(8);
    });

    it("works correctly during rebuildAndPersist", async () => {
      const events = makeGameEvents();
      prisma.gameEvent.findMany.mockResolvedValueOnce(events);
      prisma.gameSession.findUnique.mockResolvedValueOnce({
        id: "sess_rebuild",
        version: 6,
        matchId: "match_1",
        match: {
          id: "match_1",
          homeTeamId: "home_team",
          awayTeamId: "away_team",
          homeTeam: { playerTeams: [] },
          awayTeam: { playerTeams: [] },
        },
      });
      prisma.gameSession.update.mockResolvedValueOnce({
        version: 6,
        homeScore: 8,
        awayScore: 0,
      });
      prisma.projectionState.upsert.mockResolvedValueOnce({ id: "proj_1" });
      prisma.matchPlayer.findMany.mockResolvedValueOnce([]);
      redisService.setProjectionCached.mockResolvedValue(true);
      redisService.invalidateProjectionCache.mockResolvedValue(true);
      redisService.invalidateSessionSnapshotCache.mockResolvedValue(true);

      const adminUser: AuthenticatedUser = {
        id: "admin_1",
        email: "admin@test.com",
        name: "Admin",
        role: Role.ADMIN,
        clientIds: ["client_1"],
      };

      const result = await service.rebuildAndPersist("sess_rebuild", adminUser);

      expect(result.boxScore.players.starter1.secondsPlayed).toBe(600);
      expect(result.boxScore.players.sub1.secondsPlayed).toBe(1800);
      expect(result.boxScore.players.starter1.plusMinus).toBe(2);
      expect(result.boxScore.players.sub1.plusMinus).toBe(6);
    });
  });
});
