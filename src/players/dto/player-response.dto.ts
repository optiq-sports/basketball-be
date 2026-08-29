import { PlayerPosition } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class PlayerTeamResponseDto {
  @ApiProperty({ example: "pt_123" })
  id: string;

  @ApiProperty({ example: "team_123" })
  teamId: string;

  @ApiProperty({ example: 23 })
  jerseyNumber: number;

  @ApiProperty({ example: false })
  isCaptain: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  joinedAt: Date;

  @ApiProperty({ example: "2024-12-31T00:00:00Z", required: false })
  leftAt?: Date;

  @ApiProperty({ required: false })
  team?: {
    id: string;
    name: string;
    code: string;
  };
}

export class PlayerResponseDto {
  @ApiProperty({ example: "p_123" })
  id: string;

  @ApiProperty({ example: "Michael" })
  firstName: string;

  @ApiProperty({ example: "Jordan" })
  lastName: string;

  @ApiProperty({ example: "mj@bulls.com", required: false })
  email?: string;

  @ApiProperty({ example: PlayerPosition.CENTER, enum: PlayerPosition, required: false })
  position?: PlayerPosition;

  @ApiProperty({ example: "198cm", required: false })
  height?: string;

  @ApiProperty({ example: "https://example.com/photo.jpg", required: false })
  photo?: string;

  @ApiProperty({ example: "1963-02-17T00:00:00Z", required: false })
  dateOfBirth?: Date;

  @ApiProperty({ example: "+1234567890", required: false })
  phone?: string;

  @ApiProperty({ example: "USA", required: false })
  nationality?: string;

  // Top-level team shortcut fields (from first active team assignment)
  @ApiProperty({ example: "team_123", required: false })
  teamId?: string;

  @ApiProperty({ example: "Chicago Bulls", required: false })
  teamName?: string;

  @ApiProperty({ example: 23, required: false })
  jerseyNumber?: number;

  @ApiProperty({ example: false, required: false })
  isCaptain?: boolean;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: Date;

  @ApiProperty({ type: [PlayerTeamResponseDto], required: false })
  playerTeams?: PlayerTeamResponseDto[];
}

export class BulkCreatePlayersResponseDto {
  @ApiProperty({ example: 10 })
  created: number;

  @ApiProperty({ example: 2 })
  duplicates: number;

  @ApiProperty({ type: [PlayerResponseDto] })
  players: PlayerResponseDto[];

  @ApiProperty({ required: false })
  duplicateMatches: Array<{
    candidate: any; // Full candidate object passed in
    existingPlayer: {
      id: string;
      firstName: string;
      lastName: string;
    };
    similarityScore: number;
    status: string; // EXACT_MATCH or POTENTIAL_DUPLICATE
  }>;
}
