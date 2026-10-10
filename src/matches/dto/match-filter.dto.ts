import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { MatchStatus, MatchStage } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class MatchFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by tournament ID" })
  @IsOptional()
  tournamentId?: string;

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
}
