import { ApiProperty } from "@nestjs/swagger";
import {
  PlayerResponseDto,
  PlayerTeamResponseDto,
} from "../../players/dto/player-response.dto";

export class TeamResponseDto {
  @ApiProperty({ example: "team_123" })
  id: string;

  @ApiProperty({ example: "Chicago Bulls" })
  name: string;

  @ApiProperty({ example: "CHI" })
  code: string;

  @ApiProperty({ example: "#CE1141", required: false })
  color?: string;

  @ApiProperty({ example: "https://example.com/logo.png", required: false })
  logo?: string;

  @ApiProperty({ example: "USA", required: false })
  country?: string;

  @ApiProperty({ example: "Illinois", required: false })
  state?: string;

  @ApiProperty({ example: "Billy Donovan", required: false })
  coach?: string;

  @ApiProperty({ example: "Chris Fleming", required: false })
  assistantCoach?: string;

  @ApiProperty({ example: "United Center", required: false })
  arena?: string;

  @ApiProperty({ example: 1966, required: false })
  foundedYear?: number;

  @ApiProperty({ example: "contact@chicagobulls.com", required: false })
  contactEmail?: string;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: Date;
}

export class TeamWithPlayersResponseDto extends TeamResponseDto {
  @ApiProperty({ type: [PlayerTeamResponseDto], required: false })
  playerTeams?: PlayerTeamResponseDto[];

  @ApiProperty({ required: false })
  _count?: {
    playerTeams: number;
  };
}
