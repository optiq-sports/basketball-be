import { IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { BaseCommandDto } from "./base-command.dto";

export class TurnoverStealDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  teamId!: string;
}

export class TurnoverCommandDto extends BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  turnoverType!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TurnoverStealDto)
  steal?: TurnoverStealDto;
}
