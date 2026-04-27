import { BadRequestException } from "@nestjs/common";
import { validateCommandPayload } from "./validate-command-payload";

describe("validateCommandPayload", () => {
  it("accepts a valid shot payload", () => {
    const result = validateCommandPayload("shot", {
      teamId: "team_1",
      shooterPlayerId: "player_1",
      shotValue: 2,
      result: "made",
    });

    expect(result).toEqual({
      teamId: "team_1",
      shooterPlayerId: "player_1",
      shotValue: 2,
      result: "made",
    });
  });

  it("rejects malformed shot payloads", () => {
    expect(() =>
      validateCommandPayload("shot", {
        teamId: "team_1",
        shotValue: 9,
        result: "invalid",
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects unknown dead ball reason", () => {
    expect(() =>
      validateCommandPayload("dead_ball", {
        reason: "random_reason",
      }),
    ).toThrow(BadRequestException);
  });
});
