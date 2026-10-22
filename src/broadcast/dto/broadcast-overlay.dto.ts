import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsDate,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import {
  VALID_OVERLAY_SCENES,
  type OverlaySceneType,
} from "../../overlay/dto/overlay-scene.dto";

export class PutBroadcastOverlayDto {
  @ApiPropertyOptional({
    example: "player_spotlight",
    enum: VALID_OVERLAY_SCENES,
    description: "Active graphic scene to display",
  })
  @IsOptional()
  @IsIn(VALID_OVERLAY_SCENES)
  activeScene?: OverlaySceneType;

  @ApiPropertyOptional({
    example: {
      v: 1,
      title: "Player Spotlight",
      player: { name: "LeBron James", points: 28 },
    },
    description:
      "Finished content of the graphic. Must be a JSON object <= 32 KB with v: 1.",
  })
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: true,
    description: "Master on-air toggle for the overlay graphic.",
  })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Separate switch for the scorebug beside any graphic.",
  })
  @IsOptional()
  @IsBoolean()
  scorebugVisible?: boolean;

  @ApiPropertyOptional({
    example: "2026-10-20T16:00:00.000Z",
    nullable: true,
    description:
      "Timestamp when a scene auto-dismisses itself. Null when it does not.",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  autoDismissAt?: Date | null;

  @ApiPropertyOptional({
    example: "usr_broadcaster_123",
    description:
      "Broadcaster user ID (optional; only used if set by ADMIN or SUPER_ADMIN)",
  })
  @IsOptional()
  @IsString()
  broadcasterId?: string;
}

export class CreateBroadcastOverlayLinkDto {
  @ApiPropertyOptional({
    example: 24,
    description:
      "Validity duration in hours (default 24 hours, min 1, max 168)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;

  @ApiPropertyOptional({
    example: "usr_broadcaster_123",
    description:
      "Broadcaster user ID if issued by ADMIN or SUPER_ADMIN for a specific operator",
  })
  @IsOptional()
  @IsString()
  broadcasterId?: string;
}

export class BroadcastOverlayLinkResponseDto {
  @ApiProperty({
    example: "ovl_a1b2c3d4e5f6...",
    description:
      "Unguessable public overlay URL token for OBS / vMix browser source",
  })
  token: string;

  @ApiProperty({
    example: "ovl_a1b2c3d4...",
    description: "Masked token prefix for audit, reference, and display",
  })
  tokenPrefix: string;

  @ApiProperty({
    example: "2026-10-21T15:00:00.000Z",
    description: "Expiry timestamp of the overlay token",
  })
  expiresAt: Date;

  @ApiProperty({
    example: "https://broadcast.optiqsports.com/overlay/ovl_a1b2c3d4e5f6...",
    description:
      "Finished output URL to be pasted into OBS/vMix browser source",
  })
  outputUrl: string;
}

export class ActiveBroadcastOverlayLinkResponseDto {
  @ApiProperty({
    example: "ovl_a1b2c3d4...",
    description: "Masked token prefix for reference and display",
  })
  tokenPrefix: string;

  @ApiProperty({
    example: "2026-10-21T15:00:00.000Z",
    description: "Expiry timestamp of the overlay token",
  })
  expiresAt: Date;
}
