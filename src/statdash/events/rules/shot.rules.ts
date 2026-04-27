import { BadRequestException } from "@nestjs/common";
import { RuleContext, RuleResult } from "./rule.types";

type ShotPayload = {
  teamId: string;
  shooterPlayerId: string;
  shotValue: 1 | 2 | 3;
  result: "made" | "missed";
  reboundDecision?: {
    type: "offensive" | "defensive" | "dead_ball";
    playerId?: string;
    deadBallReason?: string;
    continuationShotResult?: "made" | "missed";
  };
};

export function applyShotRules(payload: ShotPayload, context: RuleContext): RuleResult {
  const events: RuleResult["emittedEvents"] = [
    {
      eventType: "shot",
      payload,
    },
  ];
  const scoreDelta = { home: 0, away: 0 };

  if (payload.result === "made") {
    if (payload.teamId === context.session.match.homeTeamId) {
      scoreDelta.home += payload.shotValue;
    } else if (payload.teamId === context.session.match.awayTeamId) {
      scoreDelta.away += payload.shotValue;
    }
    return { emittedEvents: events, scoreDelta };
  }

  if (!payload.reboundDecision) {
    return { emittedEvents: events, scoreDelta };
  }

  if (payload.reboundDecision.type === "dead_ball") {
    events.push({
      eventType: "dead_ball",
      payload: {
        reason: payload.reboundDecision.deadBallReason ?? "out_of_bounds",
        teamId: payload.teamId,
      },
    });
    return { emittedEvents: events, scoreDelta };
  }

  if (!payload.reboundDecision.playerId) {
    throw new BadRequestException({
      code: "SD_SHOT_REBOUND_PLAYER_REQUIRED",
      message: "reboundDecision.playerId is required for rebound flow",
    });
  }

  events.push({
    eventType: "rebound",
    payload: {
      teamId: payload.teamId,
      playerId: payload.reboundDecision.playerId,
      reboundType: payload.reboundDecision.type,
    },
  });

  if (
    payload.reboundDecision.type === "offensive" &&
    payload.reboundDecision.continuationShotResult
  ) {
    events.push({
      eventType: "shot",
      payload: {
        teamId: payload.teamId,
        shooterPlayerId: payload.shooterPlayerId,
        shotValue: payload.shotValue,
        result: payload.reboundDecision.continuationShotResult,
      },
    });
    if (payload.reboundDecision.continuationShotResult === "made") {
      if (payload.teamId === context.session.match.homeTeamId) {
        scoreDelta.home += payload.shotValue;
      } else if (payload.teamId === context.session.match.awayTeamId) {
        scoreDelta.away += payload.shotValue;
      }
    }
  }

  return { emittedEvents: events, scoreDelta };
}
