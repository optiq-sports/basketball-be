import { Player, PlayerPosition, PlayerTeam } from '@prisma/client';

export class PlayerTeamResponseDto {
  id: string;
  teamId: string;
  jerseyNumber: number;
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
  createdAt: Date;
  updatedAt: Date;
  playerTeams?: PlayerTeamResponseDto[];
}

export class BulkCreatePlayersResponseDto {
  created: number;
  duplicates: number;
  players: PlayerResponseDto[];
  duplicateMatches: Array<{
    candidate: {
      firstName: string;
      lastName: string;
    };
    existingPlayer: {
      id: string;
      firstName: string;
      lastName: string;
    };
    similarityScore: number;
  }>;
}

