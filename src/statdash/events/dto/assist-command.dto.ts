import { IsNotEmpty, IsString } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class AssistCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  assistedPlayerId!: string;
}
