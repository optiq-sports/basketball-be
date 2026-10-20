import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional } from "class-validator";
import { UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const STATISTICIAN_SORT_FIELDS = [
  "name",
  "email",
  "status",
  "createdAt",
  "updatedAt",
] as const;

export type StatisticianSortField = (typeof STATISTICIAN_SORT_FIELDS)[number];

export class StatisticianFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: UserStatus,
    description: "Filter by user status",
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: STATISTICIAN_SORT_FIELDS,
    default: "createdAt",
  })
  @IsOptional()
  @IsIn(STATISTICIAN_SORT_FIELDS)
  sortBy?: string = "createdAt";
}
