import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";

export class CreateAdminDto {
  @ApiProperty({ example: "admin@example.com", description: "Email address of the admin" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: "Password123!", description: "Strong password, at least 6 characters" })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: "Admin Manager", required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: Role, example: Role.ADMIN, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE, required: false })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
