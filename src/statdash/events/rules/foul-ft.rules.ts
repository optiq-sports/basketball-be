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

function resolveFreeThrowAttempts(raw: Record<string, unknown>): FreeThrowAttempt[] {
  const fromApi = raw.freeThrows;
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    const awarded =
      typeof raw.freeThrowsAwarded === "number" ? raw.freeThrowsAwarded : undefined;
    if (awarded !== undefined && awarded !== fromApi.length) {
      throw new BadRequestException({
        code: "SD_FOUL_FT_COUNT_MISMATCH",
        message:
          "freeThrows length must match freeThrowsAwarded when both are provided.",
      });
    }
    return fromApi as FreeThrowAttempt[];
  }
  const awarded =
    typeof raw.freeThrowsAwarded === "number" ? raw.freeThrowsAwarded : 0;
  if (awarded === 0) {
    return [];
  }
  throw new BadRequestException({
    code: "SD_FOUL_FREE_THROWS_REQUIRED",
    message:
      "When freeThrowsAwarded is greater than 0, send freeThrows: [{ attemptNumber, result: 'made' | 'missed' }, ...] with one entry per attempt.",
  });
}

/** Composite id `${teamId}_${jersey}` → team id; otherwise caller context must supply teamId for FT scoring. */
function shootingTeamIdForFreeThrows(fouledPlayerId: string, fallbackTeamId: string): string {
  const u = fouledPlayerId.lastIndexOf("_");
  if (u > 0) {
    return fouledPlayerId.slice(0, u);
  }
  return fallbackTeamId;
}

export function applyFoulFreeThrowRules(
  payload: FoulFtPayload | Record<string, unknown>,
  context: RuleContext,
): RuleResult {
  const raw = payload as Record<string, unknown>;
  const freeThrows = resolveFreeThrowAttempts(raw);
  const teamId = String(raw.teamId ?? "");
  const fouledPlayerId = String(raw.fouledPlayerId ?? "");
  const shootingTeamId = shootingTeamIdForFreeThrows(fouledPlayerId, teamId);

  const emittedEvents: RuleResult["emittedEvents"] = [
    {
      eventType: "foul",
      payload: {
        teamId,
        foulerPlayerId: String(raw.foulerPlayerId ?? ""),
        fouledPlayerId,
        foulType: String(raw.foulType ?? ""),
        freeThrowsAwarded: freeThrows.length,
      },
    },
  ];
  const scoreDelta = { home: 0, away: 0 };

  for (let i = 0; i < freeThrows.length; i += 1) {
    const ft = freeThrows[i];
    if (ft.attemptNumber !== i + 1) {
      throw new BadRequestException({
        code: "SD_FREE_THROW_ORDER_INVALID",
        message: "Free throw attempts must be sequential",
      });
    }

    emittedEvents.push({
      eventType: "free_throw",
      payload: {
        teamId: shootingTeamId,
        playerId: fouledPlayerId,
        attemptNumber: ft.attemptNumber,
        totalAttempts: freeThrows.length,
        result: ft.result,
      },
    });

    if (ft.result === "made") {
      if (shootingTeamId === context.session.match.homeTeamId) {
        scoreDelta.home += 1;
      } else if (shootingTeamId === context.session.match.awayTeamId) {
        scoreDelta.away += 1;
      }
    }
  }

  const lastAttempt = freeThrows[freeThrows.length - 1];
  const rebound = raw.lastMissedFreeThrowRebound as FoulFtPayload["lastMissedFreeThrowRebound"];
  if (lastAttempt?.result === "missed" && rebound) {
    if (rebound.reboundType === "dead_ball") {
      emittedEvents.push({
        eventType: "dead_ball",
        payload: {
          reason: rebound.deadBallReason ?? "out_of_bounds",
        },
      });
    } else {
      if (!rebound.playerId) {
        throw new BadRequestException({
          code: "SD_FT_REBOUND_PLAYER_REQUIRED",
          message: "playerId required for free throw rebound flow",
        });
      }
      emittedEvents.push({
        eventType: "rebound",
        payload: {
          teamId: shootingTeamId,
          playerId: rebound.playerId,
          reboundType: rebound.reboundType,
        },
      });
    }
  }

  return { emittedEvents, scoreDelta };
}
