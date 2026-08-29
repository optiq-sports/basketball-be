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
  sessionUpdates?: {
    quarter?: number;
    clockSecondsRemaining?: number;
    possessionTeamId?: string | null;
    jumpBallWinnerTeamId?: string;
  };
  newLineup?: {
    homeLineup: string[];
    awayLineup: string[];
  };
};

export type RuleContext = {
  session: Pick<GameSession, "id" | "matchId" | "homeScore" | "awayScore"> & {
    match: { homeTeamId: string; awayTeamId: string };
  };
  lineupSnapshot?: { homeLineup: string[]; awayLineup: string[] } | null;
};
