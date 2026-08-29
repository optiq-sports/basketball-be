import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class StreamQueryDto {
  @ApiPropertyOptional({ 
    description: "The version number to start streaming events from. If not provided, it streams from the current real-time state.",
    example: "14"
  })
  @IsOptional()
  @IsString()
  sinceVersion?: string;
}
