import { BadRequestException } from "@nestjs/common";
import { RuleContext, RuleResult } from "./rule.types";

type FreeThrowAttempt = {
  attemptNumber: number;
  result: "made" | "missed";
};

type FoulFtPayload = {
  teamId: string;
  foulerPlayerId: string;
  fouledPlayerId: string;
  foulType: string;
  freeThrows: FreeThrowAttempt[];
  lastMissedFreeThrowRebound?: {
    reboundType: "offensive" | "defensive" | "dead_ball";
    playerId?: string;
    deadBallReason?: string;
  };
};

export function applyFoulFreeThrowRules(
  payload: FoulFtPayload,
  context: RuleContext,
): RuleResult {
  const emittedEvents: RuleResult["emittedEvents"] = [
    {
      eventType: "foul",
      payload: {
        teamId: payload.teamId,
        foulerPlayerId: payload.foulerPlayerId,
        fouledPlayerId: payload.fouledPlayerId,
        foulType: payload.foulType,
        freeThrowsAwarded: payload.freeThrows.length,
      },
    },
  ];
  const scoreDelta = { home: 0, away: 0 };

  for (let i = 0; i < payload.freeThrows.length; i += 1) {
    const ft = payload.freeThrows[i];
    if (ft.attemptNumber !== i + 1) {
      throw new BadRequestException({
        code: "SD_FREE_THROW_ORDER_INVALID",
        message: "Free throw attempts must be sequential",
      });
    }

    emittedEvents.push({
      eventType: "free_throw",
      payload: {
        teamId: payload.teamId,
        playerId: payload.fouledPlayerId,
        attemptNumber: ft.attemptNumber,
        totalAttempts: payload.freeThrows.length,
        result: ft.result,
      },
    });

    if (ft.result === "made") {
      if (payload.teamId === context.session.match.homeTeamId) {
        scoreDelta.home += 1;
      } else if (payload.teamId === context.session.match.awayTeamId) {
        scoreDelta.away += 1;
      }
    }
  }

  const lastAttempt = payload.freeThrows[payload.freeThrows.length - 1];
  if (lastAttempt?.result === "missed" && payload.lastMissedFreeThrowRebound) {
    if (payload.lastMissedFreeThrowRebound.reboundType === "dead_ball") {
      emittedEvents.push({
        eventType: "dead_ball",
        payload: {
          reason: payload.lastMissedFreeThrowRebound.deadBallReason ?? "out_of_bounds",
        },
      });
    } else {
      if (!payload.lastMissedFreeThrowRebound.playerId) {
        throw new BadRequestException({
          code: "SD_FT_REBOUND_PLAYER_REQUIRED",
          message: "playerId required for free throw rebound flow",
        });
      }
      emittedEvents.push({
        eventType: "rebound",
        payload: {
          teamId: payload.teamId,
          playerId: payload.lastMissedFreeThrowRebound.playerId,
          reboundType: payload.lastMissedFreeThrowRebound.reboundType,
        },
      });
    }
  }

  return { emittedEvents, scoreDelta };
}
