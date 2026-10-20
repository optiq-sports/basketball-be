import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const TEAM_SORT_FIELDS = [
  "name",
  "code",
  "country",
  "state",
  "coach",
  "arena",
  "foundedYear",
  "createdAt",
  "updatedAt",
] as const;

export type TeamSortField = (typeof TEAM_SORT_FIELDS)[number];

export class TeamFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter teams by tournament ID" })
  @IsOptional()
  @IsString()
  tournamentId?: string;

  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: TEAM_SORT_FIELDS,
    default: "name",
  })
  @IsOptional()
  @IsIn(TEAM_SORT_FIELDS)
  sortBy?: string = "name";
}
