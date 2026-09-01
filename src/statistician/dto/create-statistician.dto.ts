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

export class CreateStatisticianDto {
  @ApiProperty({ example: "stat@example.com", description: "Email address" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  // Password is optional because we set a default if not provided
  @ApiProperty({
    example: "Password123!",
    required: false,
    description: "Optional custom password",
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    example: "John Doe",
    required: false,
    description: "Full name",
  })
  @IsString()
  @IsOptional()
  name?: string;

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

  @ApiProperty({ example: "Experienced statistician", required: false })
  @IsString()
  @IsOptional()
  bio?: string;
}
