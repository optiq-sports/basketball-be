import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";
import { STATDASH_SHOT_RESULTS } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class FreeThrowCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsInt()
  @Min(1)
  @Max(3)
  attemptNumber!: number;

  @IsInt()
  @Min(1)
  @Max(3)
  totalAttempts!: number;

  @IsString()
  @IsIn(STATDASH_SHOT_RESULTS)
  result!: "made" | "missed";
}
