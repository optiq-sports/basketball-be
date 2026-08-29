import { ApiProperty } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";

class StatisticianProfileDto {
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

  @ApiProperty({ example: "Experienced statistician", nullable: true })
  bio: string | null;

  @ApiProperty({ type: [String], example: ["https://example.com/photo.jpg"] })
  photos: string[];

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: Date;
}

export class StatisticianResponseDto {
  @ApiProperty({ example: "user_123" })
  id: string;

  @ApiProperty({ example: "stat@example.com" })
  email: string;

  @ApiProperty({ example: "John Doe", nullable: true })
  name: string | null;

  @ApiProperty({ enum: Role, example: Role.STATISTICIAN })
  role: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ type: StatisticianProfileDto })
  profile: StatisticianProfileDto;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: Date;
}
