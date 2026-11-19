import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddTeamToTournamentDto {
  @ApiProperty({
    example: ["team_123", "team_456"],
    description: "Array of team IDs to add to the tournament",
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  teamIds: string[];

  @ApiProperty({
    example: "A",
    description: "Group the team(s) should be assigned to",
    required: false,
  })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiProperty({
    example: false,
    description: "ADMIN/SUPER_ADMIN approval for a category mismatch",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  approveMismatch?: boolean;

  @ApiProperty({
    example: "Approved exhibition entry",
    description: "Reason for approving a category mismatch",
    required: false,
  })
  @IsOptional()
  @IsString()
  mismatchReason?: string;
}
