import { PartialType } from "@nestjs/mapped-types";
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
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

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
  @IsString()
  gender?: string;

  // These allow the frontend to update jersey number within a specific team in one request
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  jerseyNumber?: number;
}
