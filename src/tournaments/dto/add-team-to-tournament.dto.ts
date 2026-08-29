import { IsString, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTeamToTournamentDto {
  @ApiProperty({ example: ['team_123', 'team_456'], description: 'Array of team IDs to add to the tournament' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  teamIds: string[];
}
