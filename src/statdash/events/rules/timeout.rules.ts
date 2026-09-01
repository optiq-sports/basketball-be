import { BadRequestException } from "@nestjs/common";
import { RuleResult } from "./rule.types";

type TimeoutPayload = {
  teamId?: string;
  timeoutType: string;
};

export function applyTimeoutRules(payload: TimeoutPayload): RuleResult {
  if (payload.timeoutType !== "official" && !payload.teamId) {
    throw new BadRequestException("teamId is required for team timeouts");
  }

  return {
    emittedEvents: [
      {
        eventType: "timeout",
        payload,
      },
    ],
    scoreDelta: { home: 0, away: 0 },
  };
}
