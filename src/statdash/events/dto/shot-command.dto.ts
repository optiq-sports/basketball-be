import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { STATDASH_SHOT_RESULTS } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class ShotDataDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @IsIn([1, 2, 3])
  value!: 1 | 2 | 3;

  @ApiProperty({ example: "made", enum: STATDASH_SHOT_RESULTS })
  @IsString()
  @IsIn(STATDASH_SHOT_RESULTS)
  result!: "made" | "missed";

  @ApiProperty({ example: "jumpshot" })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ example: "catch_and_shoot", required: false })
  @IsOptional()
  @IsString()
  playType?: string;

  @ApiProperty({ example: 45, required: false })
  @IsOptional()
  @IsNumber()
  x?: number;

  @ApiProperty({ example: 12, required: false })
  @IsOptional()
  @IsNumber()
  y?: number;
}

export class ShotCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "player_1" })
  @IsString()
  @IsNotEmpty()
  shooterPlayerId!: string;

  @ApiProperty({ example: "player_2", required: false })
  @IsOptional()
  @IsString()
  assistPlayerId?: string;

  @ApiProperty({ example: "player_3", required: false })
  @IsOptional()
  @IsString()
  blockPlayerId?: string;

  @ApiProperty({ type: () => ShotDataDto })
  @ValidateNested()
  @Type(() => ShotDataDto)
  shot!: ShotDataDto;
}
