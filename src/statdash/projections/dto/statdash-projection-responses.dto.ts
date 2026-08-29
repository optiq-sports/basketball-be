import { ApiProperty } from "@nestjs/swagger";

export class ProjectionTotalsDto {
  @ApiProperty({ example: 25 })
  points: number;

  @ApiProperty({ example: 10 })
  rebounds: number;

  @ApiProperty({ example: 5 })
  assists: number;

  @ApiProperty({ example: 2 })
  blocks: number;

  @ApiProperty({ example: 1 })
  steals: number;

  @ApiProperty({ example: 3 })
  fouls: number;

  @ApiProperty({ example: 4 })
  turnovers: number;
}

export class PlayerProjectionDto extends ProjectionTotalsDto {
  @ApiProperty({ example: "player_123" })
  playerId: string;
}

export class BoxScoreResponseDto {
  @ApiProperty({ 
    type: "object", 
    additionalProperties: { $ref: "#/components/schemas/PlayerProjectionDto" },
    example: { 
      "player_123": { playerId: "player_123", points: 25, rebounds: 10, assists: 5, blocks: 2, steals: 1, fouls: 3, turnovers: 4 } 
    } 
  })
  players: Record<string, PlayerProjectionDto>;

  @ApiProperty({ type: ProjectionTotalsDto })
  totals: ProjectionTotalsDto;

  @ApiProperty({ example: 150 })
  totalEvents: number;
}

export class ShotChartEventDto {
  @ApiProperty({ example: "event_123" })
  eventId: string;

  @ApiProperty({ example: "team_1", nullable: true })
  teamId: string | null;

  @ApiProperty({ example: "player_123", nullable: true })
  shooterPlayerId: string | null;

  @ApiProperty({ example: "made", nullable: true })
  result: string | null;

  @ApiProperty({ example: 3, nullable: true })
  shotValue: number | null;

  @ApiProperty({ example: 45.5, nullable: true })
  x: number | null;

  @ApiProperty({ example: 22.3, nullable: true })
  y: number | null;

  @ApiProperty({ example: 10 })
  sequence: number;
}

class ScoreDto {
  @ApiProperty({ example: 102 })
  home: number;

  @ApiProperty({ example: 98 })
  away: number;
}

export class MatchSummaryResponseDto {
  @ApiProperty({ example: "session_123" })
  sessionId: string;

  @ApiProperty({ example: 45 })
  version: number;

  @ApiProperty({ type: ScoreDto })
  score: ScoreDto;

  @ApiProperty({ type: ProjectionTotalsDto })
  totals: ProjectionTotalsDto;

  @ApiProperty({ example: 150 })
  totalEvents: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  generatedAt: string;
}

export class RebuildResponseDto {
  @ApiProperty({ example: "session_123" })
  sessionId: string;

  @ApiProperty({ example: 45 })
  version: number;

  @ApiProperty({ type: ScoreDto })
  score: ScoreDto;

  @ApiProperty({ example: "proj_123" })
  projectionId: string;

  @ApiProperty({ type: BoxScoreResponseDto })
  boxScore: BoxScoreResponseDto;
}
