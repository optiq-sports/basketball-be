import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { BaseCommandDto } from "./base-command.dto";

export class SubstitutionCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "player_1" })
  @IsString()
  @IsNotEmpty()
  playerOutId!: string;

  @ApiProperty({ example: "player_4" })
  @IsString()
  @IsNotEmpty()
  playerInId!: string;
}
