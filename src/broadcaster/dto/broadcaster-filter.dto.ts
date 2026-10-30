import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const BROADCASTER_SORT_FIELDS = [
  "name",
  "email",
  "status",
  "createdAt",
  "updatedAt",
] as const;

export type BroadcasterSortField = (typeof BROADCASTER_SORT_FIELDS)[number];

export class BroadcasterFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter broadcasters by client ID",
    example: "client_123",
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: "Filter by user status",
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: BROADCASTER_SORT_FIELDS,
    default: "createdAt",
  })
  @IsOptional()
  @IsIn(BROADCASTER_SORT_FIELDS)
  sortBy?: string = "createdAt";
}
