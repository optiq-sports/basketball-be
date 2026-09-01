import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class JumpBallCommandDto {
  @ApiProperty({ example: "team_A" })
  @IsString()
  @IsNotEmpty()
  winningTeamId!: string;
}
