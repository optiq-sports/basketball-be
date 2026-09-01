import { IsNotEmpty, IsString, IsOptional, IsInt } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class JumpBallCommandDto {
  @ApiProperty({ example: "team_A" })
  @IsString()
  @IsNotEmpty()
  winningTeamId!: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  period?: number;

  @ApiProperty({ example: 720, required: false })
  @IsOptional()
  @IsInt()
  clockSecondsRemaining?: number;
}
