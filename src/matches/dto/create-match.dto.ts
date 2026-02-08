import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class CreateMatchDto {
  @IsString()
  @IsNotEmpty()
  tournamentId: string;

  @IsString()
  @IsNotEmpty()
  homeTeamId: string;

  @IsString()
  @IsNotEmpty()
  awayTeamId: string;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsString()
  venue?: string;
}

