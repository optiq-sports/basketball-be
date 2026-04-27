import { BadRequestException } from "@nestjs/common";
import { RuleResult } from "./rule.types";

type BlockPayload = {
  teamId: string;
  blockerPlayerId?: string;
  againstPlayerId: string;
  blockerSide?: "offense" | "defense";
  repeatReboundDecision?: boolean;
};

export function applyBlockRules(payload: BlockPayload): RuleResult {
  if (!payload.blockerPlayerId) {
    throw new BadRequestException({
      code: "SD_BLOCK_PLAYER_REQUIRED",
      message: "blockerPlayerId is required before rebound decision",
    });
  }
  if (payload.blockerSide !== "defense") {
    throw new BadRequestException({
      code: "SD_BLOCK_DEFENSE_ONLY",
      message: "blocker must be on defensive side",
    });
  }

  const emittedEvents: RuleResult["emittedEvents"] = [
    {
      eventType: "block",
      payload,
    },
  ];

  if (payload.repeatReboundDecision) {
    emittedEvents.push({
      eventType: "dead_ball",
      payload: {
        reason: "held_ball",
        note: "rebound_decision_reenter",
      },
    });
  }

  return {
    emittedEvents,
    scoreDelta: { home: 0, away: 0 },
  };
}
