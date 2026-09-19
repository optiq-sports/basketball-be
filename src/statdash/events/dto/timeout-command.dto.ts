import { IsIn, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { BaseCommandDto } from "./base-command.dto";

import { OmitType } from "@nestjs/swagger";

export class TimeoutCommandDto extends OmitType(BaseCommandDto, ["teamId"] as const) {
  @ApiProperty({ example: "team_1", required: false })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiProperty({ example: "full", enum: ["full", "short", "official"] })
  @IsString()
  @IsIn(["full", "short", "official"])
  timeoutType!: "full" | "short" | "official";
}
