import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { MatchStatus, MatchStage } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const MATCH_SORT_FIELDS = [
  "scheduledDate",
  "status",
  "stage",
  "venue",
  "createdAt",
  "updatedAt",
] as const;

export type MatchSortField = (typeof MATCH_SORT_FIELDS)[number];

export class MatchFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by tournament ID" })
  @IsOptional()
  @IsString()
  tournamentId?: string;

  @ApiPropertyOptional({ description: "Filter by statistician ID" })
  @IsOptional()
  @IsString()
  statisticianId?: string;

  @ApiPropertyOptional({
    enum: MatchStatus,
    description: "Filter by match status",
  })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({
    enum: MatchStage,
    description: "Filter by match stage",
  })
  @IsOptional()
  @IsEnum(MatchStage)
  stage?: MatchStage;

  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: MATCH_SORT_FIELDS,
    default: "scheduledDate",
  })
  @IsOptional()
  @IsIn(MATCH_SORT_FIELDS)
  sortBy?: string = "scheduledDate";
}
