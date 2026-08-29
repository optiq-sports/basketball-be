import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class FreeThrowAttemptPartDto {
  @IsInt()
  @Min(1)
  attemptNumber!: number;

  @IsIn(["made", "missed"])
  result!: "made" | "missed";
}

export class LastMissedFreeThrowReboundDto {
  @IsString()
  @IsIn(["offensive", "defensive", "dead_ball"])
  reboundType!: "offensive" | "defensive" | "dead_ball";

  @IsOptional()
  @IsString()
  playerId?: string;

  @IsOptional()
  @IsString()
  deadBallReason?: string;
}

export class FoulCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  foulerPlayerId!: string;

  @IsOptional()
  @IsString()
  fouledPlayerId?: string;

  @IsString()
  @IsNotEmpty()
  foulType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  freeThrowsAwarded?: number;

  /** When awarding FTs, send one entry per attempt (required if freeThrowsAwarded > 0). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FreeThrowAttemptPartDto)
  freeThrows?: FreeThrowAttemptPartDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LastMissedFreeThrowReboundDto)
  lastMissedFreeThrowRebound?: LastMissedFreeThrowReboundDto;
}
