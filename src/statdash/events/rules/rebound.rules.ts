import { BadRequestException } from "@nestjs/common";
import { RuleResult } from "./rule.types";

type ReboundPayload = {
  teamId: string;
  reboundPlayerId?: string;
  teamRebound?: boolean;
  rebound: {
    type: "offensive" | "defensive";
  };
};

export function applyReboundRules(payload: ReboundPayload): RuleResult {
  const hasPlayer =
    typeof payload.reboundPlayerId === "string" &&
    payload.reboundPlayerId.trim().length > 0;
  const isTeamRebound = payload.teamRebound === true;

  if ((hasPlayer && isTeamRebound) || (!hasPlayer && !isTeamRebound)) {
    throw new BadRequestException({
      code: "SD_COMMAND_PAYLOAD_INVALID",
      message:
        "Rebound must specify either reboundPlayerId or teamRebound: true, and not both",
    });
  }

  const eventPayload: Record<string, unknown> = {
    ...payload,
    teamId: payload.teamId,
    rebound: payload.rebound,
  };

  if (isTeamRebound) {
    eventPayload.teamRebound = true;
    delete eventPayload.reboundPlayerId;
    delete eventPayload.playerId;
  } else {
    eventPayload.reboundPlayerId = payload.reboundPlayerId;
  }

  const events: RuleResult["emittedEvents"] = [
    {
      eventType: "rebound",
      payload: eventPayload,
    },
  ];
  const scoreDelta = { home: 0, away: 0 };
  return {
    emittedEvents: events,
    scoreDelta,
    sessionUpdates: {
      possessionTeamId: payload.teamId,
    },
  };
}
