import { IsNotEmpty, IsString } from "class-validator";

export class JumpBallCommandDto {
  @IsString()
  @IsNotEmpty()
  winningTeamId!: string;
}
