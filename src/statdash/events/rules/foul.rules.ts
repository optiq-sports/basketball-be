import { RuleResult } from "./rule.types";

type FoulPayload = {
  teamId: string;
  foulerPlayerId?: string;
  fouledPlayerId?: string;
  foulType: string;
};

export function applyFoulRules(payload: FoulPayload): RuleResult {
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
