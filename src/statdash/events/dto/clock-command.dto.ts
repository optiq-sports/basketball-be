import { IsBoolean, IsInt, Max, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ClockCommandDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(10)
  quarter!: number;

  @ApiProperty({ example: 720 })
  @IsInt()
  @Min(0)
  @Max(720)
  clockSecondsRemaining!: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isRunning!: boolean;
}
