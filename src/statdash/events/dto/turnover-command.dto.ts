import { IsNotEmpty, IsString } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class TurnoverCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  turnoverType!: string;
}
