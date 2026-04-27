import { IsBoolean, IsInt, Max, Min } from "class-validator";

export class ClockCommandDto {
  @IsInt()
  @Min(1)
  @Max(10)
  quarter!: number;

  @IsInt()
  @Min(0)
  @Max(720)
  clockSecondsRemaining!: number;

  @IsBoolean()
  isRunning!: boolean;
}
