import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { BaseCommandDto } from "./base-command.dto";

export class TimeoutCommandDto extends BaseCommandDto {
  @IsString()
  @IsIn(["full", "short", "official"])
  timeoutType!: "full" | "short" | "official";
}
