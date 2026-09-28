import { ApiProperty } from '@nestjs/swagger';

export class ClientMatchTeamDto {
  @ApiProperty({ example: "" })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;
}

export class ClientMatchDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  scheduledDate: Date;

  @ApiProperty()
  homeScore: number;

  @ApiProperty()
  awayScore: number;

  @ApiProperty()
  homeTeam: ClientMatchTeamDto;

  @ApiProperty()
  awayTeam: ClientMatchTeamDto;
}

export class ClientShotChartEventDto {
  @ApiProperty({ example: "event_123" })
  eventId: string;

  @ApiProperty({ example: "team_1", nullable: true })
  teamId: string | null;

  @ApiProperty({ example: "player_123", nullable: true })
  shooterPlayerId: string | null;

  @ApiProperty({ example: "made", nullable: true })
  result: string | null;

  @ApiProperty({ example: 3, nullable: true })
  shotValue: number | null;

  @ApiProperty({ example: 10 })
  sequence: number;
}
