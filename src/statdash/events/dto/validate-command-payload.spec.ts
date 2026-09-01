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
});
