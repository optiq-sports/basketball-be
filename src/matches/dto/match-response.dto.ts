import { ApiProperty } from "@nestjs/swagger";
import { MatchStatus } from "@prisma/client";

export class MatchResponseDto {
  @ApiProperty({ example: "match_123" })
  id: string;

  @ApiProperty({ example: "tourney_123" })
  tournamentId: string;

  @ApiProperty({ example: "team_1" })
  homeTeamId: string;

  @ApiProperty({ example: "team_2" })
  awayTeamId: string;

  @ApiProperty({ example: "2024-06-01T18:00:00Z" })
  scheduledDate: Date;

  @ApiProperty({ enum: MatchStatus, example: MatchStatus.SCHEDULED })
  status: MatchStatus;

  @ApiProperty({ example: "Staples Center", required: false })
  venue?: string;

  @ApiProperty({ example: 0, required: false })
  homeScore?: number;

  @ApiProperty({ example: 0, required: false })
  awayScore?: number;

  @ApiProperty({ example: 0, required: false })
  quarter1Home?: number;

  @ApiProperty({ example: 0, required: false })
  quarter1Away?: number;

  @ApiProperty({ example: 0, required: false })
  quarter2Home?: number;

  @ApiProperty({ example: 0, required: false })
  quarter2Away?: number;

  @ApiProperty({ example: 0, required: false })
  quarter3Home?: number;

  @ApiProperty({ example: 0, required: false })
  quarter3Away?: number;

  @ApiProperty({ example: 0, required: false })
  quarter4Home?: number;

  @ApiProperty({ example: 0, required: false })
  quarter4Away?: number;

  @ApiProperty({ example: 0, required: false })
  overtimeHome?: number;

  @ApiProperty({ example: 0, required: false })
  overtimeAway?: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: Date;
}
