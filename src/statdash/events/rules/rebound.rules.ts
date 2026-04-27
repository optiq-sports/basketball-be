import { BadRequestException } from "@nestjs/common";
import { RuleContext, RuleResult } from "./rule.types";

type ReboundPayload = {
  teamId: string;
  playerId: string;
  reboundType: "offensive" | "defensive";
  followUpShotResult?: "made" | "missed";
  shotValue?: 2 | 3;
};

export function applyReboundRules(payload: ReboundPayload, context: RuleContext): RuleResult {
  const events: RuleResult["emittedEvents"] = [
    {
      eventType: "rebound",
      payload,
    },
  ];
  const scoreDelta = { home: 0, away: 0 };

  if (payload.reboundType !== "offensive" || !payload.followUpShotResult) {
    return { emittedEvents: events, scoreDelta };
  }

  if (!payload.shotValue) {
    throw new BadRequestException({
      code: "SD_REBOUND_SHOT_VALUE_REQUIRED",
      message: "shotValue is required for offensive rebound follow-up shot",
    });
  }

  events.push({
    eventType: "shot",
    payload: {
      teamId: payload.teamId,
      shooterPlayerId: payload.playerId,
      shotValue: payload.shotValue,
      result: payload.followUpShotResult,
    },
  });

  if (payload.followUpShotResult === "made") {
    if (payload.teamId === context.session.match.homeTeamId) {
      scoreDelta.home += payload.shotValue;
    } else if (payload.teamId === context.session.match.awayTeamId) {
      scoreDelta.away += payload.shotValue;
    }
  }

  return { emittedEvents: events, scoreDelta };
}
