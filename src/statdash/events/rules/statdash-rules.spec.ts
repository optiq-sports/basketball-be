import { BadRequestException } from "@nestjs/common";
import { applyBlockRules } from "./block.rules";
import { applyFoulFreeThrowRules } from "./foul-ft.rules";
import { applyShotRules } from "./shot.rules";
import { applyTurnoverStealRules } from "./turnover-steal.rules";

const context = {
  session: {
    id: "session_1",
    matchId: "match_1",
    homeScore: 0,
    awayScore: 0,
    match: {
      homeTeamId: "home_team",
      awayTeamId: "away_team",
    },
  },
};

describe("Statdash critical rules", () => {
  it("persists missed shot before rebound decision", () => {
    const result = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "p1",
        shotValue: 2,
        result: "missed",
        reboundDecision: {
          type: "defensive",
          playerId: "p2",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((item) => item.eventType)).toEqual([
      "shot",
      "rebound",
    ]);
  });

  it("supports offensive rebound loop with made finalize scoring", () => {
    const result = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "p1",
        shotValue: 2,
        result: "missed",
        reboundDecision: {
          type: "offensive",
          playerId: "p3",
          continuationShotResult: "made",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((item) => item.eventType)).toEqual([
      "shot",
      "rebound",
      "shot",
    ]);
    expect(result.scoreDelta).toEqual({ home: 2, away: 0 });
  });

  it("enforces blocker first and defensive-side only", () => {
    expect(() =>
      applyBlockRules({
        teamId: "away_team",
        againstPlayerId: "p1",
        blockerSide: "offense",
      }),
    ).toThrow(BadRequestException);

    const valid = applyBlockRules({
      teamId: "away_team",
      againstPlayerId: "p1",
      blockerPlayerId: "p4",
      blockerSide: "defense",
      repeatReboundDecision: true,
    });
    expect(valid.emittedEvents.map((item) => item.eventType)).toEqual([
      "block",
      "dead_ball",
    ]);
  });

  it("keeps foul + free throw sequence and routes last miss to rebound", () => {
    const result = applyFoulFreeThrowRules(
      {
        teamId: "home_team",
        foulerPlayerId: "f1",
        fouledPlayerId: "f2",
        foulType: "shooting",
        freeThrows: [
          { attemptNumber: 1, result: "made" },
          { attemptNumber: 2, result: "missed" },
        ],
        lastMissedFreeThrowRebound: {
          reboundType: "defensive",
          playerId: "d1",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((item) => item.eventType)).toEqual([
      "foul",
      "free_throw",
      "free_throw",
      "rebound",
    ]);
    expect(result.scoreDelta).toEqual({ home: 1, away: 0 });
  });

  it("enforces turnover steal requirements and opponent-only stealer", () => {
    expect(() =>
      applyTurnoverStealRules({
        teamId: "home_team",
        playerId: "p1",
        turnoverType: "bad_pass",
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      applyTurnoverStealRules({
        teamId: "home_team",
        playerId: "p1",
        turnoverType: "bad_pass",
        steal: {
          playerId: "p2",
          teamId: "home_team",
        },
      }),
    ).toThrow(BadRequestException);

    const valid = applyTurnoverStealRules({
      teamId: "home_team",
      playerId: "p1",
      turnoverType: "bad_pass",
      steal: {
        playerId: "p2",
        teamId: "away_team",
      },
    });
    expect(valid.emittedEvents.map((item) => item.eventType)).toEqual([
      "turnover",
      "steal",
    ]);
  });
});
