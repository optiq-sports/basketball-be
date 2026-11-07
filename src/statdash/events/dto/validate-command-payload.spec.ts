import { BadRequestException } from "@nestjs/common";
import { validateCommandPayload } from "./validate-command-payload";

describe("validateCommandPayload", () => {
  it("accepts a valid shot payload", () => {
    const result = validateCommandPayload("shot", {
      teamId: "team_1",
      shooterPlayerId: "player_1",
      shot: {
        value: 2,
        result: "made",
        type: "jumpshot",
      },
    });

    expect(result).toEqual({
      teamId: "team_1",
      shooterPlayerId: "player_1",
      shot: {
        value: 2,
        result: "made",
        type: "jumpshot",
      },
    });
  });

  it("rejects malformed shot payloads", () => {
    expect(() =>
      validateCommandPayload("shot", {
        teamId: "team_1",
        shooterPlayerId: "player_1",
        shot: {
          value: 9,
          result: "invalid",
          type: "jumpshot",
        },
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects unknown dead ball reason", () => {
    expect(() =>
      validateCommandPayload("dead_ball", {
        teamId: "team_1",
        deadBall: {
          reason: "random_reason",
        },
      }),
    ).toThrow(BadRequestException);
  });

  it("accepts a player rebound payload", () => {
    const result = validateCommandPayload("rebound", {
      teamId: "team_1",
      reboundPlayerId: "player_3",
      rebound: {
        type: "defensive",
      },
    });

    expect(result).toEqual({
      teamId: "team_1",
      reboundPlayerId: "player_3",
      rebound: {
        type: "defensive",
      },
    });
  });

  it("accepts a team rebound payload with teamRebound: true and no player", () => {
    const result = validateCommandPayload("rebound", {
      teamId: "team_1",
      teamRebound: true,
      rebound: {
        type: "offensive",
      },
    });

    expect(result).toEqual({
      teamId: "team_1",
      teamRebound: true,
      rebound: {
        type: "offensive",
      },
    });
  });

  it("refuses a rebound with neither reboundPlayerId nor teamRebound", () => {
    expect(() =>
      validateCommandPayload("rebound", {
        teamId: "team_1",
        rebound: {
          type: "offensive",
        },
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      validateCommandPayload("rebound", {
        teamId: "team_1",
        teamRebound: false,
        rebound: {
          type: "offensive",
        },
      }),
    ).toThrow(BadRequestException);
  });

  it("refuses a rebound with both reboundPlayerId and teamRebound: true", () => {
    expect(() =>
      validateCommandPayload("rebound", {
        teamId: "team_1",
        reboundPlayerId: "player_3",
        teamRebound: true,
        rebound: {
          type: "defensive",
        },
      }),
    ).toThrow(BadRequestException);
  });
});
