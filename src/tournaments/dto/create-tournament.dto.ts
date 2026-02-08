import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { TournamentDivision } from '@prisma/client';

export class CreateTournamentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(TournamentDivision)
  @IsNotEmpty()
  division: TournamentDivision;

  @IsInt()
  @Min(1)
  numberOfGames: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfQuarters?: number;

  @IsInt()
  @Min(1)
  quarterDuration: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  overtimeDuration?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsString()
  flyer?: string;

  @IsOptional()
  @IsString()
  crewChief?: string;

  @IsOptional()
  @IsString()
  umpire1?: string;

  @IsOptional()
  @IsString()
  umpire2?: string;

  @IsOptional()
  @IsString()
  commissioner?: string;
}

