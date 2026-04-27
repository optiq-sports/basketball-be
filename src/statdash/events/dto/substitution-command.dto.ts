import { IsNotEmpty, IsString } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class SubstitutionCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerOutId!: string;

  @IsString()
  @IsNotEmpty()
  playerInId!: string;
}
