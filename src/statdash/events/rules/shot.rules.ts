import { RuleContext, RuleResult } from "./rule.types";

type ShotPayload = {
  teamId: string;
  shooterPlayerId: string;
  assistPlayerId?: string;
  blockPlayerId?: string;
  shot: {
    value: 1 | 2 | 3;
    result: "made" | "missed";
    type: string;
    playType?: string;
    x?: number;
    y?: number;
  };
};

export function applyShotRules(
  payload: ShotPayload,
  context: RuleContext,
): RuleResult {
  const events: RuleResult["emittedEvents"] = [
    {
      eventType: "shot",
      payload,
    },
  ];
  const scoreDelta = { home: 0, away: 0 };

  if (payload.shot.result === "made") {
    if (payload.teamId === context.session.match.homeTeamId) {
      scoreDelta.home += payload.shot.value;
    } else if (payload.teamId === context.session.match.awayTeamId) {
      scoreDelta.away += payload.shot.value;
    }
  }

  return { emittedEvents: events, scoreDelta };
}
