import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  IsDate,
} from "class-validator";
import { Type } from "class-transformer";

export const VALID_OVERLAY_SCENES = [
  "blank",
  "player_spotlight",
  "team_comparison",
  "quarter_scores",
  "scoring_run",
  "last_play",
  "game_leaders",
  "zone_shooting",
  "starting_lineups",
] as const;

export type OverlaySceneType = (typeof VALID_OVERLAY_SCENES)[number];

export class UpsertOverlaySceneDto {
  @ApiProperty({
    example: "match_123",
    description: "Match ID for this overlay",
  })
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @ApiProperty({
    example: "player_spotlight",
    enum: VALID_OVERLAY_SCENES,
    required: false,
    description: "Active graphic scene to display",
  })
  @IsOptional()
  @IsIn(VALID_OVERLAY_SCENES)
  activeScene?: OverlaySceneType;

  @ApiProperty({
    example: {
      v: 1,
      title: "Player Spotlight",
      player: { name: "LeBron James", points: 28 },
    },
    required: false,
    description:
      "Finished content of the graphic. Must be a JSON object <= 32 KB with v: 1.",
  })
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiProperty({
    example: true,
    required: false,
    description: "Master on-air toggle for the overlay graphic.",
  })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiProperty({
    example: true,
    required: false,
    description: "Separate switch for the scorebug beside any graphic.",
  })
  @IsOptional()
  @IsBoolean()
  scorebugVisible?: boolean;

  @ApiProperty({
    example: "2026-10-19T20:00:00.000Z",
    required: false,
    nullable: true,
    description:
      "Timestamp when a scene auto-dismisses itself. Null when it does not.",
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  autoDismissAt?: Date | null;
}

export class PatchOverlaySceneDto {
  @ApiProperty({
    example: "match_123",
    required: false,
    description: "Match ID for this overlay (optional if specified in path)",
  })
  @IsOptional()
  @IsString()
  matchId?: string;

  @ApiProperty({
    example: "player_spotlight",
    enum: VALID_OVERLAY_SCENES,
    required: false,
  })
  @IsOptional()
  @IsIn(VALID_OVERLAY_SCENES)
  activeScene?: OverlaySceneType;

  @ApiProperty({
    example: { v: 1, title: "Player Spotlight" },
    required: false,
  })
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiProperty({
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiProperty({
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  scorebugVisible?: boolean;

  @ApiProperty({
    example: "2026-10-19T20:00:00.000Z",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  autoDismissAt?: Date | null;
}

export class OverlaySceneResponseDto {
  @ApiProperty({ example: "player_spotlight", enum: VALID_OVERLAY_SCENES })
  activeScene: string;

  @ApiProperty({ example: true })
  visible: boolean;

  @ApiProperty({ example: true })
  scorebugVisible: boolean;

  @ApiProperty({ example: "2026-10-19T20:00:00.000Z", nullable: true })
  autoDismissAt: Date | null;

  @ApiProperty({ example: { v: 1 } })
  payload: Record<string, unknown>;

  @ApiProperty({ example: "2026-10-19T19:55:00.000Z" })
  updatedAt: Date;
}
