import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class BaseCommandDto {
  @ApiProperty({ example: "team_A" })
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  period?: number;

  @ApiProperty({ example: 720, required: false })
  @IsOptional()
  @IsInt()
  clockSecondsRemaining?: number;
}
