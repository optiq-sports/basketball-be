import { ApiProperty } from "@nestjs/swagger";
import { TournamentDivision } from "@prisma/client";

export class TournamentResponseDto {
  @ApiProperty({ example: "tourney_123" })
  id: string;

  @ApiProperty({ example: "Summer Pro League 2024" })
  name: string;

  @ApiProperty({ example: "SPL2024" })
  code: string;

  @ApiProperty({
    enum: TournamentDivision,
    example: TournamentDivision.DIVISION_1,
  })
  division: TournamentDivision;

  @ApiProperty({ example: 82 })
  numberOfGames: number;

  @ApiProperty({ example: 4 })
  numberOfQuarters: number;

  @ApiProperty({ example: 10 })
  quarterDuration: number;

  @ApiProperty({ example: 5, required: false })
  overtimeDuration?: number;

  @ApiProperty({ example: "2024-06-01T00:00:00Z" })
  startDate: Date;

  @ApiProperty({ example: "2024-08-31T00:00:00Z", required: false })
  endDate?: Date;

  @ApiProperty({ example: "Staples Center", required: false })
  venue?: string;

  @ApiProperty({ example: "https://example.com/flyer.jpg", required: false })
  flyer?: string;

  @ApiProperty({ example: "John Doe", required: false })
  crewChief?: string;

  @ApiProperty({ example: "Jane Smith", required: false })
  umpire1?: string;

  @ApiProperty({ example: "Mike Johnson", required: false })
  umpire2?: string;

  @ApiProperty({ example: "Adam Silver", required: false })
  commissioner?: string;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  updatedAt: Date;

  @ApiProperty({ type: [Object], example: [], required: false })
  teams?: any[];

  @ApiProperty({ type: [Object], example: [], required: false })
  matches?: any[];
}
