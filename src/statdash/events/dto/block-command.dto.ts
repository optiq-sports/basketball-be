import { IsNotEmpty, IsString } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class BlockCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  blockerPlayerId!: string;

  @IsString()
  @IsNotEmpty()
  againstPlayerId!: string;
}
