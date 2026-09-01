import { RuleResult } from "./rule.types";

type TurnoverPayload = {
  teamId: string;
  turnoverPlayerId: string;
  stealPlayerId?: string;
  turnover: {
    type: string;
  };
};

export function applyTurnoverRules(payload: TurnoverPayload): RuleResult {
  const emittedEvents: RuleResult["emittedEvents"] = [
    {
      eventType: "turnover",
      payload: {
        teamId: payload.teamId,
        playerId: payload.turnoverPlayerId,
        turnoverType: payload.turnover.type,
      },
    },
  ];

  return { emittedEvents, scoreDelta: { home: 0, away: 0 } };
}
