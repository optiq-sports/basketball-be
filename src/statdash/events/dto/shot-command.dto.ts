import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { STATDASH_SHOT_RESULTS } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class ShotReboundDecisionDto {
  @IsString()
  @IsIn(["offensive", "defensive", "dead_ball"])
  type!: "offensive" | "defensive" | "dead_ball";

  @IsOptional()
  @IsString()
  playerId?: string;

  @IsOptional()
  @IsString()
  deadBallReason?: string;

  @IsOptional()
  @IsString()
  @IsIn(["made", "missed"])
  continuationShotResult?: "made" | "missed";
}

export class ShotCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  shooterPlayerId!: string;

  @IsInt()
  @IsIn([1, 2, 3])
  shotValue!: 1 | 2 | 3;

  @IsString()
  @IsIn(STATDASH_SHOT_RESULTS)
  result!: "made" | "missed";

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShotReboundDecisionDto)
  reboundDecision?: ShotReboundDecisionDto;
}
