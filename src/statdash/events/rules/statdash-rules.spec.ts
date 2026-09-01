import { applyFoulRules } from "./foul.rules";
import { applyFreeThrowRules } from "./free-throw.rules";
import { applyShotRules } from "./shot.rules";
import { applyTurnoverRules } from "./turnover.rules";

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

describe("Statdash rules", () => {
  it("emits shot event", () => {
    const result = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "p1",
        shot: {
          value: 2,
          result: "missed",
          type: "jumpshot",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((item) => item.eventType)).toEqual([
      "shot",
    ]);
  });

  it("adds score for made shot", () => {
    const result = applyShotRules(
      {
        teamId: "home_team",
        shooterPlayerId: "p1",
        shot: {
          value: 2,
          result: "made",
          type: "jumpshot",
        },
      },
      context,
    );

    expect(result.emittedEvents.map((item) => item.eventType)).toEqual([
      "shot",
    ]);
    expect(result.scoreDelta).toEqual({ home: 2, away: 0 });
  });

  it("emits free throw event and score", () => {
    const result = applyFreeThrowRules(
      {
        teamId: "home_team",
        shooterPlayerId: "p1",
        attempt: 1,
        totalAttempts: 2,
        result: "made",
      },
      context,
    );

    expect(result.emittedEvents.map((item) => item.eventType)).toEqual([
      "free_throw",
    ]);
    expect(result.scoreDelta).toEqual({ home: 1, away: 0 });
  });

  it("emits foul event", () => {
    const result = applyFoulRules({
      teamId: "home_team",
      foulerPlayerId: "f1",
      fouledPlayerId: "f2",
      foulType: "shooting",
    });

    expect(result.emittedEvents.map((item) => item.eventType)).toEqual([
      "foul",
    ]);
    expect(result.scoreDelta).toEqual({ home: 0, away: 0 });
  });

  it("emits turnover event", () => {
    const valid = applyTurnoverRules({
      teamId: "home_team",
      turnoverPlayerId: "p1",
      stealPlayerId: "p2",
      turnover: {
        type: "bad_pass",
      },
    });
    expect(valid.emittedEvents.map((item) => item.eventType)).toEqual([
      "turnover",
    ]);
  });
});
