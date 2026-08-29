import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { STATDASH_REBOUND_TYPES } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class ReboundCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsIn(STATDASH_REBOUND_TYPES)
  reboundType!: "offensive" | "defensive";

  @IsOptional()
  @IsString()
  @IsIn(["made", "missed"])
  followUpShotResult?: "made" | "missed";

  @IsOptional()
  @IsInt()
  @IsIn([2, 3])
  shotValue?: 2 | 3;
}
