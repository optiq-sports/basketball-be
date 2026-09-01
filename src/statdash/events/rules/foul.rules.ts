import { BadRequestException } from "@nestjs/common";
import { RuleResult } from "./rule.types";

type FoulPayload = {
  teamId: string;
  foulerPlayerId?: string;
  fouledPlayerId?: string;
  foulerRole?: string;
  foulType: string;
};

export function applyFoulRules(payload: FoulPayload): RuleResult {
  if (!payload.foulerPlayerId && (!payload.foulerRole || payload.foulerRole === "player")) {
    throw new BadRequestException("foulerPlayerId is required for player fouls");
  }

  if (payload.foulerPlayerId && !payload.foulerRole) {
    payload.foulerRole = "player";
  }

  return {
    emittedEvents: [
      {
        eventType: "foul",
        payload,
      },
    ],
    scoreDelta: { home: 0, away: 0 },
  };
}
