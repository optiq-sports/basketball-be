import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class FoulCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  foulerPlayerId!: string;

  @IsOptional()
  @IsString()
  fouledPlayerId?: string;

  @IsString()
  @IsNotEmpty()
  foulType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  freeThrowsAwarded?: number;
}
