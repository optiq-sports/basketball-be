import { StatdashEventType } from "./event-types";

export type StatdashEventPayload = {
  eventType: StatdashEventType;
  payload: Record<string, unknown>;
};

export type ShotPayload = {
  teamId: string;
  shooterPlayerId: string;
  shotValue: 2 | 3 | 1;
  result: "made" | "missed";
  x?: number;
  y?: number;
};

export type AssistPayload = {
  teamId: string;
  playerId: string;
  assistedPlayerId: string;
};

export type ReboundPayload = {
  teamId: string;
  playerId: string;
  reboundType: "offensive" | "defensive";
};

export type BlockPayload = {
  teamId: string;
  blockerPlayerId: string;
  againstPlayerId: string;
};

export type FoulPayload = {
  teamId: string;
  foulerPlayerId: string;
  fouledPlayerId?: string;
  foulType: string;
  freeThrowsAwarded?: number;
};

export type FreeThrowPayload = {
  teamId: string;
  playerId: string;
  attemptNumber: number;
  totalAttempts: number;
  result: "made" | "missed";
};

export type TurnoverPayload = {
  teamId: string;
  playerId: string;
  turnoverType: string;
};

export type StealPayload = {
  teamId: string;
  playerId: string;
  againstPlayerId: string;
};

export type DeadBallPayload = {
  reason:
    | "out_of_bounds"
    | "shot_clock_violation"
    | "held_ball"
    | "lane_violation";
  teamId?: string;
};

export type SubstitutionPayload = {
  teamId: string;
  playerOutId: string;
  playerInId: string;
};

export type JumpBallPayload = {
  winningTeamId: string;
};

export type TimeoutPayload = {
  teamId: string;
  timeoutType: "full" | "short" | "official";
};

export type ClockPayload = {
  quarter: number;
  clockSecondsRemaining: number;
  isRunning: boolean;
};
