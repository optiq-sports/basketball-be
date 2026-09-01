import { ApiProperty } from "@nestjs/swagger";
import { GameSessionStatus, MatchStatus } from "@prisma/client";

export class ResolveMatchKeyResponseDto {
  @ApiProperty({
    example: "cmtdrhinr0000sb9ld34vjt4w",
    description: "The ID of the match",
  })
  matchId: string;

  @ApiProperty({ enum: MatchStatus, example: MatchStatus.SCHEDULED })
  matchStatus: MatchStatus;

  @ApiProperty({
    example: "session_123",
    description: "The ID of the active session, if any",
    nullable: true,
  })
  sessionId: string | null;

  @ApiProperty({
    enum: GameSessionStatus,
    example: GameSessionStatus.IN_PROGRESS,
    nullable: true,
  })
  sessionStatus: GameSessionStatus | null;
}

export class StatdashSessionDto {
  @ApiProperty({ example: "session_123" })
  id: string;

  @ApiProperty({ example: "match_123" })
  matchId: string;

  @ApiProperty({
    enum: GameSessionStatus,
    example: GameSessionStatus.IN_PROGRESS,
  })
  status: GameSessionStatus;

  @ApiProperty({ example: 1 })
  quarter: number;

  @ApiProperty({ example: 600 })
  clockSecondsRemaining: number;

  @ApiProperty({ example: 82 })
  homeScore: number;

  @ApiProperty({ example: 76 })
  awayScore: number;

  @ApiProperty({ example: true })
  homeOnLeft: boolean;

  @ApiProperty({ example: true })
  homeAttacksLeft: boolean;

  @ApiProperty({ example: "team_1", nullable: true })
  jumpBallWinnerTeamId: string | null;

  @ApiProperty({ example: "team_1", nullable: true })
  possessionTeamId: string | null;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z", nullable: true })
  startedAt: Date | null;

  @ApiProperty({ example: "2024-01-01T02:00:00Z", nullable: true })
  endedAt: Date | null;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: Date;
}

class EventDto {
  @ApiProperty({ example: "event_123" })
  id: string;

  @ApiProperty({ example: 1 })
  sequence: number;

  @ApiProperty({ example: "SHOT" })
  eventType: string;

  @ApiProperty({ example: { points: 2, player: "player_1" } })
  payload: any;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: 1, nullable: true })
  period: number | null;

  @ApiProperty({ example: 600, nullable: true })
  clockSecondsRemaining: number | null;
}

export class StatdashSessionSnapshotDto {
  @ApiProperty({ example: "session_123" })
  sessionId: string;

  @ApiProperty({ example: "match_123" })
  matchId: string;

  @ApiProperty({
    enum: GameSessionStatus,
    example: GameSessionStatus.IN_PROGRESS,
  })
  status: GameSessionStatus;

  @ApiProperty({ example: 1 })
  quarter: number;

  @ApiProperty({ example: 600 })
  clockSecondsRemaining: number;

  @ApiProperty({ example: { home: 82, away: 76 } })
  score: {
    home: number;
    away: number;
  };

  @ApiProperty({ example: { homeOnLeft: true, homeAttacksLeft: true } })
  orientation: {
    homeOnLeft: boolean;
    homeAttacksLeft: boolean;
  };

  @ApiProperty({ example: "team_1", nullable: true })
  jumpBallWinnerTeamId: string | null;

  @ApiProperty({ example: "team_1", nullable: true })
  possessionTeamId: string | null;

  @ApiProperty({
    example: { homeLineup: ["player_1"], awayLineup: ["player_2"] },
  })
  activeLineups: any;

  @ApiProperty({ type: [EventDto] })
  recentEvents: EventDto[];

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z", nullable: true })
  startedAt: Date | null;

  @ApiProperty({ example: "2024-01-01T02:00:00Z", nullable: true })
  endedAt: Date | null;
}
