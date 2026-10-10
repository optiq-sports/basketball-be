import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class PlayerFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter players by team ID" })
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({ description: "Set to true to get unassigned players" })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  unassigned?: boolean;
}
