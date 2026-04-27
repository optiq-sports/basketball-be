import { GameSession } from "@prisma/client";
import { StatdashCommandType } from "../../contracts/event-types";

export type RuleEventDraft = {
  eventType: StatdashCommandType;
  payload: Record<string, unknown>;
};

export type RuleResult = {
  emittedEvents: RuleEventDraft[];
  scoreDelta: {
    home: number;
    away: number;
  };
};

export type RuleContext = {
  session: Pick<GameSession, "id" | "matchId" | "homeScore" | "awayScore"> & {
    match: { homeTeamId: string; awayTeamId: string };
  };
};
