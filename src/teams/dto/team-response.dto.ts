import { ApiProperty } from "@nestjs/swagger";
import { PlayerResponseDto, PlayerTeamResponseDto } from "../../players/dto/player-response.dto";

export class TeamResponseDto {
  @ApiProperty({ example: "team_123" })
  id: string;

  @ApiProperty({ example: "Chicago Bulls" })
  name: string;

  @ApiProperty({ example: "CHI" })
  code: string;

  @ApiProperty({ example: "https://example.com/logo.png", required: false })
  logo?: string;

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
