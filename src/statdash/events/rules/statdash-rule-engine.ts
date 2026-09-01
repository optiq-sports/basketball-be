import { BadRequestException } from "@nestjs/common";
import type { StatdashCommandType } from "../../contracts/event-types";
import { applyFoulRules } from "./foul.rules";
import { applyFreeThrowRules } from "./free-throw.rules";
import { applyReboundRules } from "./rebound.rules";
import { RuleContext, RuleResult } from "./rule.types";
import { applyShotRules } from "./shot.rules";
import { applyTurnoverRules } from "./turnover.rules";
import { applyTimeoutRules } from "./timeout.rules";

export function applyCommandRules(
  commandType: StatdashCommandType,
  payload: Record<string, unknown>,
  context: RuleContext,
): RuleResult {
  let result: RuleResult;

  switch (commandType) {
    case "shot":
      result = applyShotRules(payload as never, context);
      break;
    case "rebound":
      result = applyReboundRules(payload as never);
      break;
    case "foul":
      result = applyFoulRules(payload as never);
      break;
    case "free_throw":
      result = applyFreeThrowRules(payload as never, context);
      break;
    case "turnover":
      result = applyTurnoverRules(payload as never);
      break;
    case "timeout":
      result = applyTimeoutRules(payload as never);
      break;
    default:
      result = {
        emittedEvents: [{ eventType: commandType, payload }],
        scoreDelta: { home: 0, away: 0 },
      };
      break;
  }

  // Extract clock updates
  if (typeof payload.period === "number") {
    result.sessionUpdates = {
      ...result.sessionUpdates,
      quarter: payload.period,
    };
  }
  if (typeof payload.clockSecondsRemaining === "number") {
    result.sessionUpdates = {
      ...result.sessionUpdates,
      clockSecondsRemaining: payload.clockSecondsRemaining,
    };
  }
  if (
    typeof payload.possessionTeamId === "string" ||
    payload.possessionTeamId === null
  ) {
    result.sessionUpdates = {
      ...result.sessionUpdates,
      possessionTeamId: payload.possessionTeamId as string | null,
    };
  }
  if (typeof payload.jumpBallWinnerTeamId === "string") {
    result.sessionUpdates = {
      ...result.sessionUpdates,
      jumpBallWinnerTeamId: payload.jumpBallWinnerTeamId,
    };
  }

  // Apply substitution Lineup swapping
  if (commandType === "substitution") {
    const p = payload as Record<string, unknown>;
    const homeLineup = p.homeLineup as string[] | undefined;
    const awayLineup = p.awayLineup as string[] | undefined;
    const hasFullLineup = homeLineup || awayLineup;

    if (hasFullLineup) {
      result.newLineup = {
        homeLineup: homeLineup ?? (context.lineupSnapshot?.homeLineup ?? []),
        awayLineup: awayLineup ?? (context.lineupSnapshot?.awayLineup ?? []),
      };
    } else if (context.lineupSnapshot) {
      const { playerOutId, playerInId, teamId } = payload as Record<string, string>;
      const isHome = teamId === context.session.match.homeTeamId;
      const isAway = teamId === context.session.match.awayTeamId;

      if (isHome || isAway) {
        const newLineup = {
          homeLineup: [...context.lineupSnapshot.homeLineup],
          awayLineup: [...context.lineupSnapshot.awayLineup],
        };

        const targetLineup = isHome ? newLineup.homeLineup : newLineup.awayLineup;
        const index = targetLineup.indexOf(playerOutId);
        if (index !== -1) {
          targetLineup[index] = playerInId;
        } else {
          targetLineup.push(playerInId);
        }

        result.newLineup = newLineup;
      }
    }
  }

  return result;
}

export function assertExpectedVersion(
  sessionVersion: number,
  expectedVersion: number,
) {
  if (sessionVersion !== expectedVersion) {
    throw new BadRequestException({
      code: "SD_VERSION_MISMATCH",
      message: `Expected version ${expectedVersion} but found ${sessionVersion}`,
    });
  }
}
