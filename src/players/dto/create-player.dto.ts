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

export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(PlayerPosition)
  position?: PlayerPosition;

  @IsOptional()
  @IsString()
  height?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  confirmDuplicate?: boolean;
}
