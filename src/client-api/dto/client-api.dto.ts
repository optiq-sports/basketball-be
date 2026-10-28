import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsIn, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ClientPlayerRosterDto {
  @ApiProperty({ example: "player_123" })
  id: string;

  @ApiProperty({ example: "LeBron James" })
  name: string;

  @ApiProperty({ example: "LeBron" })
  firstName: string;

  @ApiProperty({ example: "James" })
  lastName: string;

  @ApiPropertyOptional({ example: 23, nullable: true })
  jerseyNumber?: number | null;

  @ApiPropertyOptional({
    example: "https://example.com/photo.jpg",
    nullable: true,
  })
  photo?: string | null;

  @ApiPropertyOptional({ example: "Forward", nullable: true })
  position?: string | null;
}

export class ClientMatchTeamDto {
  @ApiProperty({ example: "team_1" })
  id: string;

  @ApiProperty({ example: "Lakers" })
  name: string;

  @ApiProperty({ example: "LAL" })
  code: string;

  @ApiPropertyOptional({ example: "#552583", nullable: true })
  color?: string | null;

  @ApiPropertyOptional({
    example: "https://example.com/logo.png",
    nullable: true,
  })
  logo?: string | null;

  @ApiPropertyOptional({ type: [ClientPlayerRosterDto] })
  players?: ClientPlayerRosterDto[];
}

export class ClientMatchTournamentDto {
  @ApiProperty({ example: "tourney_123" })
  id: string;

  @ApiProperty({ example: "Summer League 2026" })
  name: string;
}

export class ClientMatchDto {
  @ApiProperty({ example: "match_123" })
  id: string;

  @ApiProperty({ example: "SCHEDULED" })
  status: string;

  @ApiProperty({ example: "2026-10-25T19:00:00.000Z" })
  scheduledDate: Date;

  @ApiProperty({ example: 0 })
  homeScore: number;

  @ApiProperty({ example: 0 })
  awayScore: number;

  @ApiProperty({ example: "tourney_123" })
  tournamentId: string;

  @ApiProperty({ example: "Summer League 2026" })
  tournamentName: string;

  @ApiPropertyOptional({ type: ClientMatchTournamentDto })
  tournament?: ClientMatchTournamentDto;

  @ApiPropertyOptional({ example: "Madison Square Garden", nullable: true })
  venue: string | null;

  @ApiProperty({ type: ClientMatchTeamDto })
  homeTeam: ClientMatchTeamDto;

  @ApiProperty({ type: ClientMatchTeamDto })
  awayTeam: ClientMatchTeamDto;
}

export class ClientMatchQueryDto {
  @ApiPropertyOptional({
    description: "Optional tournament ID to filter matches",
    example: "tourney_123",
  })
  @IsOptional()
  tournamentId?: string;

  @ApiPropertyOptional({
    description: "Optional client ID. Defaults to assigned client.",
    example: "client_123",
  })
  @IsOptional()
  clientId?: string;
}

export class ClientShotChartEventDto {
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

  @ApiProperty({ example: 10 })
  sequence: number;
}

export class ClientTeamDto {
  @ApiProperty({ example: "team_123" })
  id: string;

  @ApiProperty({ example: "Lakers" })
  name: string;

  @ApiProperty({ example: "LAL" })
  code: string;

  @ApiProperty({ example: "#552583", nullable: true })
  color: string | null;

  @ApiProperty({ example: "https://example.com/logo.png", nullable: true })
  logo: string | null;

  @ApiProperty({ example: "USA", nullable: true })
  country: string | null;

  @ApiProperty({ example: "California", nullable: true })
  state: string | null;

  @ApiProperty({ example: "Coach Name", nullable: true })
  coach: string | null;

  @ApiProperty({ example: "Crypto.com Arena", nullable: true })
  arena: string | null;
}

export class ClientRosterPlayerDto {
  @ApiProperty({ example: "player_123" })
  id: string;

  @ApiProperty({ example: "LeBron" })
  firstName: string;

  @ApiProperty({ example: "James" })
  lastName: string;

  @ApiProperty({ example: 23 })
  jerseyNumber: number;

  @ApiProperty({ example: "SF", nullable: true })
  position: string | null;

  @ApiProperty({ example: "6'9\"", nullable: true })
  height: string | null;

  @ApiProperty({ example: "https://example.com/player.png", nullable: true })
  photo: string | null;

  @ApiProperty({ example: "USA", nullable: true })
  nationality: string | null;

  @ApiProperty({ example: true })
  isCaptain: boolean;
}

export class ClientTeamDetailDto extends ClientTeamDto {
  @ApiProperty({ type: [ClientRosterPlayerDto] })
  roster: ClientRosterPlayerDto[];
}

export class ClientTournamentDto {
  @ApiProperty({ example: "tourney_123" })
  id: string;

  @ApiProperty({ example: "Summer League 2026" })
  name: string;

  @ApiProperty({ example: "DIVISION_1" })
  division: string;

  @ApiProperty({ example: "ROUND_ROBIN", nullable: true })
  format: string | null;

  @ApiProperty({ example: "SL2026" })
  code: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty({ nullable: true })
  endDate: Date | null;

  @ApiProperty({ nullable: true })
  venue: string | null;

  @ApiProperty({ example: 82 })
  numberOfGames: number;

  @ApiProperty({ example: 4 })
  numberOfQuarters: number;

  @ApiProperty({ example: 10 })
  quarterDuration: number;

  @ApiProperty({ example: 5, nullable: true })
  overtimeDuration: number | null;
}

export class ClientTournamentTeamSummaryDto {
  @ApiProperty({ example: "team_123" })
  id: string;

  @ApiProperty({ example: "Lakers" })
  name: string;

  @ApiProperty({ example: "LAL" })
  code: string;

  @ApiProperty({ nullable: true })
  logo: string | null;

  @ApiProperty({ example: "Group A", nullable: true })
  group: string | null;
}

export class ClientTournamentDetailDto extends ClientTournamentDto {
  @ApiProperty({ type: [ClientTournamentTeamSummaryDto] })
  teams: ClientTournamentTeamSummaryDto[];
}

export class ClientStandingDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: "team_123" })
  teamId: string;

  @ApiProperty({ example: "Lakers" })
  teamName: string;

  @ApiProperty({ example: "LAL" })
  teamCode: string;

  @ApiProperty({ nullable: true })
  teamLogo: string | null;

  @ApiProperty({ example: 10 })
  played: number;

  @ApiProperty({ example: 8 })
  won: number;

  @ApiProperty({ example: 2 })
  lost: number;

  @ApiProperty({ example: 1050 })
  pointsFor: number;

  @ApiProperty({ example: 980 })
  pointsAgainst: number;

  @ApiProperty({ example: 70 })
  pointsDiff: number;

  @ApiProperty({ example: 18 })
  points: number;

  @ApiProperty({ example: 0.8 })
  winPercentage: number;

  @ApiProperty({ example: "W3" })
  streak: string;
}

export enum LeaderCategory {
  POINTS = "points",
  REBOUNDS = "rebounds",
  ASSISTS = "assists",
  STEALS = "steals",
  BLOCKS = "blocks",
  TURNOVERS = "turnovers",
  FG3M = "fg3m",
}

export class ClientLeadersQueryDto {
  @ApiProperty({
    example: LeaderCategory.POINTS,
    enum: LeaderCategory,
    required: false,
    description:
      "Stat category: points, rebounds, assists, steals, blocks, turnovers, fg3m",
  })
  @IsOptional()
  @IsIn([
    "points",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "fg3m",
  ])
  category?: LeaderCategory;

  @ApiProperty({
    example: 10,
    required: false,
    description: "Number of leaders to return (max 50)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ClientLeaderDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: "player_123" })
  playerId: string;

  @ApiProperty({ example: "LeBron" })
  firstName: string;

  @ApiProperty({ example: "James" })
  lastName: string;

  @ApiProperty({ example: 23, nullable: true })
  jerseyNumber: number | null;

  @ApiProperty({ nullable: true })
  photo: string | null;

  @ApiProperty({ example: "team_123" })
  teamId: string;

  @ApiProperty({ example: "Lakers" })
  teamName: string;

  @ApiProperty({ example: "LAL" })
  teamCode: string;

  @ApiProperty({ example: 10 })
  gamesPlayed: number;

  @ApiProperty({ example: 280 })
  totalValue: number;

  @ApiProperty({ example: 28.0 })
  perGameValue: number;
}
