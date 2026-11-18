import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";

export class BroadcasterProfileDto {
  @ApiProperty({ example: "profile_123" })
  id: string;

  @ApiProperty({ example: "user_123" })
  userId: string;

  @ApiProperty({ example: "John Doe", nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 1, nullable: true })
  dobDay: number | null;

  @ApiProperty({ example: 5, nullable: true })
  dobMonth: number | null;

  @ApiProperty({ example: 1990, nullable: true })
  dobYear: number | null;

  @ApiProperty({ example: "+1234567890", nullable: true })
  phone: string | null;

  @ApiProperty({ example: "USA", nullable: true })
  country: string | null;

  @ApiProperty({ example: "California", nullable: true })
  state: string | null;

  @ApiProperty({ example: "123 Main St", nullable: true })
  homeAddress: string | null;

  @ApiProperty({ example: "Lead commentator", nullable: true })
  bio: string | null;

  @ApiProperty({ type: [String], example: ["https://example.com/photo.jpg"] })
  photos: string[];

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  updatedAt: Date;
}

export class BroadcasterAssignedMatchDto {
  @ApiProperty({ example: "match_123" })
  matchId: string;

  @ApiPropertyOptional({ example: { id: "team_1", name: "Lakers" } })
  homeTeam?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: { id: "team_2", name: "Bulls" } })
  awayTeam?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: "2026-06-01T18:00:00Z" })
  scheduledDate?: Date | null;

  @ApiPropertyOptional({ example: "Staples Center" })
  venue?: string | null;

  @ApiPropertyOptional({ example: "SCHEDULED" })
  status?: string | null;

  @ApiPropertyOptional({ example: "tourn_123" })
  tournamentId?: string | null;

  @ApiPropertyOptional({ example: 0 })
  homeScore?: number | null;

  @ApiPropertyOptional({ example: 0 })
  awayScore?: number | null;
}

export class BroadcasterClientSummaryDto {
  @ApiProperty({ example: "client_123" })
  id: string;

  @ApiProperty({ example: "Organization 1" })
  name: string;
}

export class BroadcasterResponseDto {
  @ApiProperty({ example: "user_123" })
  id: string;

  @ApiProperty({ example: "broadcaster@example.com" })
  email: string;

  @ApiProperty({ example: "One Sport TV", nullable: true })
  name: string | null;

  @ApiProperty({ enum: Role, example: Role.BROADCASTER })
  role: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiPropertyOptional({ type: BroadcasterProfileDto })
  profile?: BroadcasterProfileDto | null;

  @ApiPropertyOptional({ example: true })
  emailSent?: boolean;

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiPropertyOptional({
    type: [BroadcasterAssignedMatchDto],
    description: "Matches assigned to this broadcaster",
  })
  assignedMatches?: BroadcasterAssignedMatchDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ["client_123"],
    description: "Client IDs this broadcaster belongs to",
  })
  clientIds?: string[];

  @ApiPropertyOptional({
    type: [BroadcasterClientSummaryDto],
    description: "Clients this broadcaster belongs to",
  })
  clients?: BroadcasterClientSummaryDto[];
}
