import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { PlayerPosition } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const PLAYER_SORT_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "position",
  "height",
  "createdAt",
  "updatedAt",
  "jerseyNumber",
  "teamName",
] as const;

export type PlayerSortField = (typeof PLAYER_SORT_FIELDS)[number];

export class PlayerFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter players by team ID" })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ description: "Set to true to get unassigned players" })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({
    description: "Filter players by position",
    enum: PlayerPosition,
  })
  @IsOptional()
  @IsEnum(PlayerPosition)
  position?: PlayerPosition;

  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: PLAYER_SORT_FIELDS,
    default: "lastName",
  })
  @IsOptional()
  @IsIn(PLAYER_SORT_FIELDS)
  sortBy?: string = "lastName";
}
