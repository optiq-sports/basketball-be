import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
} from "class-validator";
import { UserStatus } from "@prisma/client";

export class CreateStatisticianDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  // Password is optional because we set a default if not provided
  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  // Profile fields
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsOptional()
  dobDay?: number;

  @IsOptional()
  dobMonth?: number;

  @IsOptional()
  dobYear?: number;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  homeAddress?: string;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @IsString()
  @IsOptional()
  bio?: string;
}
