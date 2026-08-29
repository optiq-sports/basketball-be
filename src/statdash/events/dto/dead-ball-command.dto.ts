import { IsIn, IsOptional, IsString } from "class-validator";
import { STATDASH_DEAD_BALL_REASONS } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class DeadBallCommandDto extends BaseCommandDto {
  @IsString()
  @IsIn(STATDASH_DEAD_BALL_REASONS)
  reason!: (typeof STATDASH_DEAD_BALL_REASONS)[number];

  @IsOptional()
  @IsString()
  note?: string;
}
