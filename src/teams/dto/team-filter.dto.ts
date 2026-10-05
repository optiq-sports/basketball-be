import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class TeamFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter teams by tournament ID" })
  @IsOptional()
  @IsString()
  tournamentId?: string;
}
