import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class BlockCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  blockerPlayerId!: string;

  @IsString()
  @IsNotEmpty()
  againstPlayerId!: string;

  @IsOptional()
  @IsString()
  @IsIn(["offense", "defense"])
  blockerSide?: "offense" | "defense";

  @IsOptional()
  @IsBoolean()
  repeatReboundDecision?: boolean;
}
