import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { STATDASH_SHOT_RESULTS } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

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
}
