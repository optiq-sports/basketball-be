import { IsNotEmpty, IsOptional, IsString, IsIn } from "class-validator";
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

  @ApiProperty({ example: "player", enum: ["player", "bench", "coach"], required: false })
  @IsOptional()
  @IsIn(["player", "bench", "coach"])
  foulerRole?: string;

  @ApiProperty({ example: "shooting" })
  @IsString()
  @IsNotEmpty()
  foulType!: string;
}
