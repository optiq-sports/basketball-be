import { PartialType, ApiProperty } from "@nestjs/swagger";
import { CreatePlayerDto } from "./create-player.dto";
import {
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
  IsDateString,
  IsInt,
  IsNumber,
} from "class-validator";
import { PlayerPosition } from "@prisma/client";
import { Type } from "class-transformer";

export class UpdatePlayerDto extends PartialType(CreatePlayerDto) {
  @ApiProperty({
    example: "Michael",
    description: "First name of the player",
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    example: "Jordan",
    description: "Last name of the player",
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

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

  @ApiProperty({ example: "Male", description: "Gender", required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  // These allow the frontend to update jersey number within a specific team in one request
  @ApiProperty({
    example: "team123",
    description: "The ID of the team",
    required: false,
  })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiProperty({
    example: 23,
    description: "Jersey number of the player",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  jerseyNumber?: number;
}
