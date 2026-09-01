import { RuleContext, RuleResult } from "./rule.types";

type FreeThrowPayload = {
  teamId: string;
  shooterPlayerId: string;
  attempt: number;
  totalAttempts: number;
  result: "made" | "missed";
  assistCandidatePlayerId?: string;
};

export function applyFreeThrowRules(
  payload: FreeThrowPayload,
  context: RuleContext,
): RuleResult {
  const scoreDelta = { home: 0, away: 0 };

  if (payload.result === "made") {
    if (payload.teamId === context.session.match.homeTeamId) {
      scoreDelta.home += 1;
    } else if (payload.teamId === context.session.match.awayTeamId) {
      scoreDelta.away += 1;
    }
  }

  return {
    emittedEvents: [
      {
        eventType: "free_throw",
        payload,
      },
    ],
    scoreDelta,
  };
}
