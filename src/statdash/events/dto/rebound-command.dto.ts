import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { STATDASH_REBOUND_TYPES } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class ReboundCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsIn(STATDASH_REBOUND_TYPES)
  reboundType!: "offensive" | "defensive";
}
