import { BadRequestException } from "@nestjs/common";
import { StatdashCommandType } from "../../contracts/event-types";
import { applyBlockRules } from "./block.rules";
import { applyFoulFreeThrowRules } from "./foul-ft.rules";
import { applyReboundRules } from "./rebound.rules";
import { RuleContext, RuleResult } from "./rule.types";
import { applyShotRules } from "./shot.rules";
import { applyTurnoverStealRules } from "./turnover-steal.rules";

export function applyCommandRules(
  commandType: StatdashCommandType,
  payload: Record<string, unknown>,
  context: RuleContext,
): RuleResult {
  switch (commandType) {
    case "shot":
      return applyShotRules(payload as never, context);
    case "rebound":
      return applyReboundRules(payload as never, context);
    case "block":
      return applyBlockRules(payload as never);
    case "foul":
      return applyFoulFreeThrowRules(payload as never, context);
    case "turnover":
      return applyTurnoverStealRules(payload as never);
    default:
      return {
        emittedEvents: [{ eventType: commandType, payload }],
        scoreDelta: { home: 0, away: 0 },
      };
  }
}

export function assertExpectedVersion(sessionVersion: number, expectedVersion: number) {
  if (sessionVersion !== expectedVersion) {
    throw new BadRequestException({
      code: "SD_VERSION_MISMATCH",
      message: `Expected version ${expectedVersion} but found ${sessionVersion}`,
    });
  }
}
