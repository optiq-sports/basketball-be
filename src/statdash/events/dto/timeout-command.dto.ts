import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { BaseCommandDto } from "./base-command.dto";

export class TimeoutCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "full", enum: ["full", "short", "official"] })
  @IsString()
  @IsIn(["full", "short", "official"])
  timeoutType!: "full" | "short" | "official";
}
