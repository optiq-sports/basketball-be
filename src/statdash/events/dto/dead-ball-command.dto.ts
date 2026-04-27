import { IsIn, IsOptional, IsString } from "class-validator";
import { STATDASH_DEAD_BALL_REASONS } from "../../contracts/event-types";

export class DeadBallCommandDto {
  @IsString()
  @IsIn(STATDASH_DEAD_BALL_REASONS)
  reason!: (typeof STATDASH_DEAD_BALL_REASONS)[number];

  @IsOptional()
  @IsString()
  teamId?: string;
}
