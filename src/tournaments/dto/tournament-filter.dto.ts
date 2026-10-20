import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const TOURNAMENT_SORT_FIELDS = [
  "name",
  "division",
  "numberOfGames",
  "startDate",
  "endDate",
  "venue",
  "createdAt",
  "updatedAt",
] as const;

export type TournamentSortField = (typeof TOURNAMENT_SORT_FIELDS)[number];

export class TournamentFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: TOURNAMENT_SORT_FIELDS,
    default: "createdAt",
  })
  @IsOptional()
  @IsIn(TOURNAMENT_SORT_FIELDS)
  sortBy?: string = "createdAt";
}
