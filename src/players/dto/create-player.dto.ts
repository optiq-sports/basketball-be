import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsEnum,
  IsEmail,
  IsDateString,
  Min,
  Max,
} from "class-validator";
import { PlayerPosition } from "@prisma/client";

import { ApiProperty } from "@nestjs/swagger";

export class CreatePlayerDto {
  @ApiProperty({ example: "Michael", description: "First name of the player" })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: "Jordan", description: "Last name of the player" })
  @IsString()
  @IsNotEmpty()
  lastName: string;

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
    example: false,
    description: "Bypass deduplication check",
    required: false,
  })
  @IsOptional()
  confirmDuplicate?: boolean;
}
