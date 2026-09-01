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
  const emittedEvents: import("./rule.types").RuleEventDraft[] = [
    {
      eventType: "free_throw",
      payload,
    },
  ];

  if (payload.result === "made") {
    if (payload.teamId === context.session.match.homeTeamId) {
      scoreDelta.home += 1;
    } else if (payload.teamId === context.session.match.awayTeamId) {
      scoreDelta.away += 1;
    }
  }

  // FIBA Assist logic: Award an assist if at least one FT in the sequence is made
  // Check if an assist candidate exists and hasn't already been awarded for this sequence
  let assistCandidate = payload.assistCandidatePlayerId;
  let assistAlreadyAwarded = false;

  if (payload.attempt > 1 && context.recentEvents) {
    for (const event of context.recentEvents) {
      if (event.eventType === "free_throw") {
        const p = event.payload as Record<string, any>;
        if (p.shooterPlayerId === payload.shooterPlayerId) {
          if (p.assistCandidatePlayerId) {
            assistCandidate = p.assistCandidatePlayerId as string;
          }
          if (p.result === "made") {
            assistAlreadyAwarded = true;
          }
          if (p.attempt === 1) break;
        } else {
          break; // Different shooter, sequence broken
        }
      } else if (
        event.eventType !== "assist" &&
        event.eventType !== "foul" &&
        event.eventType !== "substitution" &&
        event.eventType !== "timeout"
      ) {
        break; // Flow interrupted
      }
    }
  }

  if (assistCandidate && !assistAlreadyAwarded && payload.result === "made") {
    emittedEvents.push({
      eventType: "assist",
      payload: {
        teamId: payload.teamId,
        assistPlayerId: assistCandidate,
        period: (payload as any).period,
        clockSecondsRemaining: (payload as any).clockSecondsRemaining,
      },
    });
  }

  return {
    emittedEvents,
    scoreDelta,
  };
}
