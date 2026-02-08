import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchDto } from './create-match.dto';
import { IsOptional, IsInt, IsEnum, Min } from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter1Home?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter1Away?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter2Home?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter2Away?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter3Home?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter3Away?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter4Home?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quarter4Away?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  overtimeHome?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  overtimeAway?: number;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}

