import { IsOptional, IsString, IsDateString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AuditLogFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Filter by entity type (e.g. tournament, match, team, player, client)",
    example: "tournament",
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({
    description: "Filter by action (e.g. DELETE, UPDATE_ROLE, CREATE_API_KEY)",
    example: "DELETE",
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: "Filter by actor user ID",
    example: "user_123",
  })
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional({
    description: "Filter logs created on or after this ISO date",
    example: "2026-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter logs created on or before this ISO date",
    example: "2026-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
