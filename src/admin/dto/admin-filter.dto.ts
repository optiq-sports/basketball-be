import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional } from "class-validator";
import { Role, UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const USER_SORT_FIELDS = [
  "name",
  "email",
  "role",
  "status",
  "createdAt",
  "updatedAt",
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class AdminFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role, description: "Filter by role" })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: "Filter by user status",
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: USER_SORT_FIELDS,
    default: "createdAt",
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: string = "createdAt";
}
