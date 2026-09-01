import { IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { STATDASH_DEAD_BALL_REASONS } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class DeadBallDataDto {
  @ApiProperty({ example: "out_of_bounds", enum: STATDASH_DEAD_BALL_REASONS })
  @IsString()
  @IsIn(STATDASH_DEAD_BALL_REASONS)
  reason!: (typeof STATDASH_DEAD_BALL_REASONS)[number];
}

export class DeadBallCommandDto extends BaseCommandDto {
  @ApiProperty({ type: () => DeadBallDataDto })
  @ValidateNested()
  @Type(() => DeadBallDataDto)
  deadBall!: DeadBallDataDto;

  @ApiProperty({ example: "Ball rolled away", required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
