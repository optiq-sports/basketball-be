import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ example: 'Chicago Bulls', description: 'Name of the team' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'CHI', description: 'Code/Abbreviation for the team' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: '#CE1141', description: 'Primary color of the team', required: false })

  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 'https://example.com/logo.png', description: 'URL to the team logo', required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ example: 'USA', description: 'Country of the team', required: false })

  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'Illinois', description: 'State of the team', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'Billy Donovan', description: 'Head coach name', required: false })

  @IsOptional()
  @IsString()
  coach?: string;

  @ApiProperty({ example: 'Chris Fleming', description: 'Assistant coach name', required: false })
  @IsOptional()
  @IsString()
  assistantCoach?: string;
}

