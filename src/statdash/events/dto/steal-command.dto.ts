import { IsNotEmpty, IsString } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class StealCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  againstPlayerId!: string;
}
