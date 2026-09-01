import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { BaseCommandDto } from "./base-command.dto";

export class TurnoverDataDto {
  @ApiProperty({ example: "bad_pass" })
  @IsString()
  @IsNotEmpty()
  type!: string;
}

export class TurnoverCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "player_1" })
  @IsString()
  @IsNotEmpty()
  turnoverPlayerId!: string;

  @ApiProperty({ example: "player_X", required: false })
  @IsOptional()
  @IsString()
  stealPlayerId?: string;

  @ApiProperty({ type: () => TurnoverDataDto })
  @ValidateNested()
  @Type(() => TurnoverDataDto)
  turnover!: TurnoverDataDto;
}
