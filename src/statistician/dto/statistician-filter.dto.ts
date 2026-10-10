import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class StatisticianFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: UserStatus,
    description: "Filter by user status",
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
