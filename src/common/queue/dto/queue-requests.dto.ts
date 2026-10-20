import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class RequeueDeadLetterQueryDto {
  @ApiPropertyOptional({
    description: "The maximum number of dead letter jobs to requeue",
    example: 25,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 25;
}

export class GetDeadLetterQueryDto {
  @ApiPropertyOptional({
    description: "The maximum number of dead letter jobs to return",
    example: 25,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 25;

  @ApiPropertyOptional({
    description: "The offset index to start retrieving dead letter jobs from",
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
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
