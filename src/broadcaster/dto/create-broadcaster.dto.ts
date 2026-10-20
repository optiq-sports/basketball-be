import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserStatus } from "@prisma/client";

export class CreateBroadcasterDto {
  @ApiProperty({
    example: "broadcaster@example.com",
    description: "Email address",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: "Password123!",
    required: false,
    description: "Optional custom password",
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    example: "One Sport TV",
    required: false,
    description: "Full name or broadcaster name",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: "cmuv056p50000c9proo4a12nu",
    required: false,
    description:
      "Optional client ID to link the broadcaster to (defaults to current admin's client)",
  })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  // Profile fields
  @ApiProperty({ example: "John", required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: "Doe", required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  dobDay?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  dobMonth?: number;

  @ApiProperty({ example: 1990, required: false })
  @IsOptional()
  dobYear?: number;

  @ApiProperty({ example: "+1234567890", required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: "USA", required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: "California", required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: "123 Main St", required: false })
  @IsString()
  @IsOptional()
  homeAddress?: string;

  @ApiProperty({
    type: [String],
    example: ["https://example.com/photo.jpg"],
    required: false,
  })
  @IsArray()
  @IsOptional()
  photos?: string[];

  @ApiProperty({ example: "https://example.com/photo.jpg", required: false })
  @IsString()
  @IsOptional()
  photo?: string;

  @ApiProperty({ example: "Lead broadcast commentator", required: false })
  @IsString()
  @IsOptional()
  bio?: string;
}
