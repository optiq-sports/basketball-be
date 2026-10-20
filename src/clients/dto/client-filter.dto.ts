import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ClientFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Search clients by name" })
  @IsOptional()
  @IsString()
  search?: string;
}
