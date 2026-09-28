import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { MatchStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class MatchFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by tournament ID" })
  @IsOptional()
  tournamentId?: string;

  @ApiPropertyOptional({ enum: MatchStatus, description: "Filter by match status" })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}
