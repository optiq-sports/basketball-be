export const STATDASH_EVENT_TYPES = [
  "shot",
  "rebound",
  "foul",
  "free_throw",
  "turnover",
  "dead_ball",
  "substitution",
  "jump_ball",
  "timeout",
  "clock",
  "assist",
  "reversal",
] as const;

export type StatdashEventType = (typeof STATDASH_EVENT_TYPES)[number];

export const STATDASH_SHOT_RESULTS = ["made", "missed"] as const;
export type StatdashShotResult = (typeof STATDASH_SHOT_RESULTS)[number];

export const STATDASH_REBOUND_TYPES = ["offensive", "defensive"] as const;
export type StatdashReboundType = (typeof STATDASH_REBOUND_TYPES)[number];

export const STATDASH_DEAD_BALL_REASONS = [
  "out_of_bounds",
  "shot_clock_violation",
  "held_ball",
  "lane_violation",
] as const;
export type StatdashDeadBallReason =
  (typeof STATDASH_DEAD_BALL_REASONS)[number];

export const STATDASH_COMMAND_TYPES = [
  "shot",
  "rebound",
  "foul",
  "free_throw",
  "turnover",
  "dead_ball",
  "substitution",
  "jump_ball",
  "timeout",
  "clock",
  "assist",
  "reversal",
] as const;
export type StatdashCommandType = (typeof STATDASH_COMMAND_TYPES)[number];
