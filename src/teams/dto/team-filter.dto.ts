import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class TeamFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter teams by tournament ID" })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;
}
