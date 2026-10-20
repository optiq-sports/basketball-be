import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateOverlayTokenDto {
  @ApiProperty({
    example: "match_123",
    description: "Match ID to scope this overlay token to",
  })
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @ApiProperty({
    required: false,
    example: 24,
    description: "Expiry duration in hours (default 24 hours, min 1, max 72)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  expiresInHours?: number;

  @ApiProperty({
    required: false,
    example: "client-id",
    description: "Client ID if created by ADMIN or SUPER_ADMIN",
  })
  @IsOptional()
  @IsString()
  clientId?: string;
}
