import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TournamentDivision } from '@prisma/client';

export class CreateTournamentDto {
  @ApiProperty({ example: 'Summer Pro League 2024', description: 'Name of the tournament' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TournamentDivision, example: TournamentDivision.DIVISION_1, description: 'Division of the tournament' })
  @IsEnum(TournamentDivision)
  @IsNotEmpty()
  division: TournamentDivision;

  @ApiProperty({ example: 82, description: 'Number of games in the tournament' })
  @IsInt()
  @Min(1)
  numberOfGames: number;

  @ApiProperty({ example: 4, description: 'Number of quarters per game', required: false })
  @Min(1)
  @IsOptional()
  numberOfQuarters?: number;

  @ApiProperty({ example: 10, description: 'Duration of each quarter in minutes' })
  @IsInt()
  @Min(1)
  quarterDuration: number;

  @ApiProperty({ example: 5, description: 'Duration of overtime periods in minutes', required: false })
  @Min(1)
  @IsOptional()
  overtimeDuration?: number;

  @ApiProperty({ example: '2024-06-01T00:00:00Z', description: 'Start date of the tournament' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-08-31T00:00:00Z', description: 'End date of the tournament', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 'Staples Center', description: 'Venue where tournament is held', required: false })
  @IsString()
  venue?: string;

  @ApiProperty({ example: 'https://example.com/flyer.jpg', description: 'URL to the tournament flyer/logo', required: false })
  @IsOptional()
  @IsString()
  flyer?: string;

  @ApiProperty({ example: 'John Doe', description: 'Crew Chief name', required: false })
  @IsString()
  crewChief?: string;

  @ApiProperty({ example: 'Jane Smith', description: 'First Umpire name', required: false })
  @IsOptional()
  @IsString()
  umpire1?: string;

  @ApiProperty({ example: 'Mike Johnson', description: 'Second Umpire name', required: false })
  @IsString()
  umpire2?: string;

  @ApiProperty({ example: 'Adam Silver', description: 'Commissioner name', required: false })
  @IsOptional()
  @IsString()
  commissioner?: string;
}

