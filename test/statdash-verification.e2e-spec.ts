import { applyBlockRules } from "../src/statdash/events/rules/block.rules";
import { applyFoulFreeThrowRules } from "../src/statdash/events/rules/foul-ft.rules";
import { applyShotRules } from "../src/statdash/events/rules/shot.rules";

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

describe("StatDash Verification Matrix E2E scenarios", () => {
  it("E2E-01 missed shot -> block involved -> blocker -> rebound decision -> block repeat", () => {
    const missedShot = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "h1",
        shotValue: 2,
        result: "missed",
      },
      context,
    );
    const block1 = applyBlockRules({
      teamId: "away_team",
      againstPlayerId: "h1",
      blockerPlayerId: "a4",
      blockerSide: "defense",
      repeatReboundDecision: true,
    });
    const block2 = applyBlockRules({
      teamId: "away_team",
      againstPlayerId: "h1",
      blockerPlayerId: "a5",
      blockerSide: "defense",
      repeatReboundDecision: true,
    });

    expect(missedShot.emittedEvents.map((e) => e.eventType)).toEqual(["shot"]);
    expect(block1.emittedEvents.map((e) => e.eventType)).toEqual([
      "block",
      "dead_ball",
    ]);
    expect(block2.emittedEvents.map((e) => e.eventType)).toEqual([
      "block",
      "dead_ball",
    ]);
  });

  it("E2E-02 missed shot -> offensive rebound made -> shooter made -> score/log finalize", () => {
    const result = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "h2",
        shotValue: 2,
        result: "missed",
        reboundDecision: {
          type: "offensive",
          playerId: "h3",
          continuationShotResult: "made",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((e) => e.eventType)).toEqual([
      "shot",
      "rebound",
      "shot",
    ]);
    expect(result.scoreDelta).toEqual({ home: 2, away: 0 });
  });

  it("E2E-03 missed shot -> offensive rebound miss -> rebound decision repeat", () => {
    const result = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "h2",
        shotValue: 2,
        result: "missed",
        reboundDecision: {
          type: "offensive",
          playerId: "h3",
          continuationShotResult: "missed",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((e) => e.eventType)).toEqual([
      "shot",
      "rebound",
      "shot",
    ]);
    expect(result.scoreDelta).toEqual({ home: 0, away: 0 });
  });

  it("E2E-04 foul -> FT sequence -> last FT miss -> rebound decision branch", () => {
    const result = applyFoulFreeThrowRules(
      {
        teamId: "away_team",
        foulerPlayerId: "h4",
        fouledPlayerId: "a1",
        foulType: "shooting",
        freeThrows: [
          { attemptNumber: 1, result: "made" },
          { attemptNumber: 2, result: "missed" },
        ],
        lastMissedFreeThrowRebound: {
          reboundType: "defensive",
          playerId: "h5",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((e) => e.eventType)).toEqual([
      "foul",
      "free_throw",
      "free_throw",
      "rebound",
    ]);
    expect(result.scoreDelta).toEqual({ home: 0, away: 1 });
  });

  it("E2E-05 dead-ball exits from shot and FT-miss rebound paths", () => {
    const shotDeadBall = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "h6",
        shotValue: 3,
        result: "missed",
        reboundDecision: {
          type: "dead_ball",
          deadBallReason: "out_of_bounds",
        },
      },
      context,
    );
    const foulDeadBall = applyFoulFreeThrowRules(
      {
        teamId: "away_team",
        foulerPlayerId: "h7",
        fouledPlayerId: "a2",
        foulType: "shooting",
        freeThrows: [{ attemptNumber: 1, result: "missed" }],
        lastMissedFreeThrowRebound: {
          reboundType: "dead_ball",
          deadBallReason: "shot_clock_violation",
        },
      },
      context,
    );

    expect(shotDeadBall.emittedEvents.map((e) => e.eventType)).toEqual([
      "shot",
      "dead_ball",
    ]);
    expect(foulDeadBall.emittedEvents.map((e) => e.eventType)).toEqual([
      "foul",
      "free_throw",
      "dead_ball",
    ]);
  });
});
