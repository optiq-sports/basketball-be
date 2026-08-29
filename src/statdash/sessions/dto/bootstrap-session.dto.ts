import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class BootstrapSessionDto {
  @ApiProperty({ example: "match_123", required: false, description: "Match ID to bootstrap the session for" })
  @IsOptional()
  @IsString()
  matchId?: string;

  @ApiProperty({ example: "session_123", required: false, description: "Session ID to bootstrap" })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
