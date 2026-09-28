import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { Role, UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AdminFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role, description: "Filter by role" })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus, description: "Filter by user status" })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
