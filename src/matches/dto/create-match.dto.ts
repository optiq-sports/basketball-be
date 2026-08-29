import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MatchStatus } from '@prisma/client';

export class CreateMatchDto {
  @ApiProperty({ example: 'tourney_123', description: 'ID of the tournament' })
  @IsString()
  @IsNotEmpty()
  tournamentId: string;

  @ApiProperty({ example: 'team_1', description: 'ID of the home team' })
  @IsString()
  @IsNotEmpty()
  homeTeamId: string;

  @ApiProperty({ example: 'team_2', description: 'ID of the away team' })
  @IsString()
  @IsNotEmpty()
  awayTeamId: string;

  @ApiProperty({ example: '2024-06-01T18:00:00Z', description: 'Scheduled date and time of the match' })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({ enum: MatchStatus, example: MatchStatus.SCHEDULED, description: 'Current status of the match', required: false })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiProperty({ example: 'Staples Center', description: 'Venue where the match is played', required: false })
  @IsOptional()
  @IsString()
  venue?: string;
}

