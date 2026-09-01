import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { STATDASH_SHOT_RESULTS } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class FreeThrowCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "player_1" })
  @IsString()
  @IsNotEmpty()
  shooterPlayerId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(3)
  attempt!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(3)
  totalAttempts!: number;

  @ApiProperty({ example: "made", enum: STATDASH_SHOT_RESULTS })
  @IsString()
  @IsIn(STATDASH_SHOT_RESULTS)
  result!: "made" | "missed";

  @ApiProperty({ example: "player_2", required: false })
  @IsOptional()
  @IsString()
  assistCandidatePlayerId?: string;
}
