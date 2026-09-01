import { RuleContext, RuleResult } from "./rule.types";

type ReboundPayload = {
  teamId: string;
  reboundPlayerId: string;
  rebound: {
    type: "offensive" | "defensive";
  };
};

export function applyReboundRules(payload: ReboundPayload): RuleResult {
  const events: RuleResult["emittedEvents"] = [
    {
      eventType: "rebound",
      payload,
    },
  ];
  const scoreDelta = { home: 0, away: 0 };
  return { emittedEvents: events, scoreDelta };
}
