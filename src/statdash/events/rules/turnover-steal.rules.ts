import { BadRequestException } from "@nestjs/common";
import { RuleResult } from "./rule.types";

type TurnoverPayload = {
  teamId: string;
  playerId: string;
  turnoverType:
    | "bad_pass"
    | "travel"
    | "shot_clock"
    | "offensive_foul"
    | "double_dribble"
    | "backcourt_violation"
    | "five_seconds";
  steal?: {
    playerId: string;
    teamId: string;
  };
};

const STEAL_REQUIRED = new Set(["bad_pass"]);
const STEAL_FORBIDDEN = new Set([
  "travel",
  "shot_clock",
  "double_dribble",
  "backcourt_violation",
  "five_seconds",
]);

export function applyTurnoverStealRules(payload: TurnoverPayload): RuleResult {
  if (STEAL_REQUIRED.has(payload.turnoverType) && !payload.steal) {
    throw new BadRequestException({
      code: "SD_STEAL_REQUIRED",
      message: "Steal is required for this turnover type",
    });
  }
  if (STEAL_FORBIDDEN.has(payload.turnoverType) && payload.steal) {
    throw new BadRequestException({
      code: "SD_STEAL_NOT_ALLOWED",
      message: "Steal is not allowed for this turnover type",
    });
  }
  if (payload.steal && payload.steal.teamId === payload.teamId) {
    throw new BadRequestException({
      code: "SD_STEAL_OPPONENT_ONLY",
      message: "Stealer must belong to opponent team",
    });
  }

  const emittedEvents: RuleResult["emittedEvents"] = [
    {
      eventType: "turnover",
      payload: {
        teamId: payload.teamId,
        playerId: payload.playerId,
        turnoverType: payload.turnoverType,
      },
    },
  ];

  if (payload.steal) {
    emittedEvents.push({
      eventType: "steal",
      payload: {
        teamId: payload.steal.teamId,
        playerId: payload.steal.playerId,
        againstPlayerId: payload.playerId,
      },
    });
  }

  return { emittedEvents, scoreDelta: { home: 0, away: 0 } };
}
