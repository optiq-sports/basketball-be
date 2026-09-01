import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { BaseCommandDto } from "./base-command.dto";

export class FoulCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "player_1", required: false })
  @IsOptional()
  @IsString()
  foulerPlayerId?: string;

  @ApiProperty({ example: "player_2", required: false })
  @IsOptional()
  @IsString()
  fouledPlayerId?: string;

  @ApiProperty({ example: "shooting" })
  @IsString()
  @IsNotEmpty()
  foulType!: string;
}
