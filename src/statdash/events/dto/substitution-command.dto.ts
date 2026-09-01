import { IsArray, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { BaseCommandDto } from "./base-command.dto";

export class SubstitutionCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "player_1", required: false })
  @IsString()
  @IsOptional()
  playerOutId?: string;

  @ApiProperty({ example: "player_4", required: false })
  @IsString()
  @IsOptional()
  playerInId?: string;

  @ApiProperty({ example: ["player_1", "player_2"], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  homeLineup?: string[];

  @ApiProperty({ example: ["player_3", "player_4"], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  awayLineup?: string[];
}
