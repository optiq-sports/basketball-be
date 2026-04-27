export type GameClockState = {
  quarter: number;
  clockSecondsRemaining: number;
  isRunning: boolean;
};

export type GameScoreState = {
  homeScore: number;
  awayScore: number;
};

export type GameOrientationState = {
  homeOnLeft: boolean;
  homeAttacksLeft: boolean;
};

export type StatdashGameState = GameClockState &
  GameScoreState &
  GameOrientationState & {
    sessionId: string;
    matchId: string;
    version: number;
    possessionTeamId: string | null;
    jumpBallWinnerTeamId: string | null;
    startedAt: string | null;
    endedAt: string | null;
  };
