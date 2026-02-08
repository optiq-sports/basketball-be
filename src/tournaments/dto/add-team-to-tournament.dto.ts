import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class AddTeamToTournamentDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  teamIds: string[];
}

