import { IsOptional, IsString } from "class-validator";

export class BootstrapSessionDto {
  @IsOptional()
  @IsString()
  matchId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
