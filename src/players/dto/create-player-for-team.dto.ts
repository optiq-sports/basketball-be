import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsEnum,
  IsEmail,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from "class-validator";
import { PlayerPosition, Gender } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class CreatePlayerForTeamDto {
  @ApiProperty({ example: "team123", description: "The ID of the team" })
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({ example: "Michael", description: "First name of the player" })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: "Jordan", description: "Last name of the player" })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 23, description: "Jersey number of the player" })
  @IsInt()
  @Min(0)
  @Max(99)
  jerseyNumber: number;

  @ApiProperty({
    example: "mj@bulls.com",
    description: "Email of the player",
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: PlayerPosition.CENTER,
    enum: PlayerPosition,
    description: "Position of the player",
    required: false,
  })
  @IsOptional()
  @IsEnum(PlayerPosition)
  position?: PlayerPosition;

  @ApiProperty({
    example: "198cm",
    description: "Height of the player",
    required: false,
  })
  @IsOptional()
  @IsString()
  height?: string;

  @ApiProperty({
    example: "https://example.com/photo.jpg",
    description: "URL to the player's photo",
    required: false,
  })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiProperty({
    example: "1963-02-17",
    description: "Date of birth (ISO 8601)",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    example: "+1234567890",
    description: "Phone number",
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: "USA", description: "Nationality", required: false })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: "Gender of the player (MALE, FEMALE)",
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    example: false,
    description: "Bypass deduplication check",
    required: false,
  })
  @IsOptional()
  confirmDuplicate?: boolean;

  @ApiProperty({
    example: false,
    description:
      "ADMIN/SUPER_ADMIN approval for a gender/team category mismatch",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  approveMismatch?: boolean;

  @ApiProperty({
    example: "Approved exhibition roster",
    description: "Reason for approving a gender/team category mismatch",
    required: false,
  })
  @IsOptional()
  @IsString()
  mismatchReason?: string;
}
