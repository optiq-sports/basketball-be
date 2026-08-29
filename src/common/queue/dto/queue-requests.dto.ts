import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RequeueDeadLetterQueryDto {
  @ApiPropertyOptional({
    description: "The maximum number of dead letter jobs to requeue",
    example: "25",
  })
  @IsOptional()
  @IsString()
  limit?: string;
}

export class WarmSessionQueryDto {
  @ApiProperty({
    description: "The ID of the session to warm caches for",
    example: "session_123",
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
