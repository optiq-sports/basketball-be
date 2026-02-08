import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsInt,
  IsOptional,
  IsEnum,
  IsEmail,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlayerPosition } from '@prisma/client';

class PlayerDataDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsInt()
  @Min(0)
  @Max(99)
  jerseyNumber: number;

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
}

export class BulkCreatePlayersForTeamDto {
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerDataDto)
  players: PlayerDataDto[];
}

