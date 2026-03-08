import { PlayerPosition } from "@prisma/client";

export class PlayerTeamResponseDto {
  id: string;
  teamId: string;
  jerseyNumber: number;
  isCaptain: boolean;
  isActive: boolean;
  joinedAt: Date;
  leftAt?: Date;
  team?: {
    id: string;
    name: string;
    code: string;
  };
}

export class PlayerResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  position?: PlayerPosition;
  height?: string;
  photo?: string;
  dateOfBirth?: Date;
  phone?: string;
  nationality?: string;
  // Top-level team shortcut fields (from first active team assignment)
  teamId?: string;
  teamName?: string;
  jerseyNumber?: number;
  isCaptain?: boolean;
  createdAt: Date;
  updatedAt: Date;
  playerTeams?: PlayerTeamResponseDto[];
}

export class BulkCreatePlayersResponseDto {
  created: number;
  duplicates: number;
  players: PlayerResponseDto[];
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
