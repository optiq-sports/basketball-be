import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { AuditLogsService } from "./audit-logs.service";
import { AuditLogFilterDto } from "./dto/audit-log-filter.dto";
import { AuditLogResponseDto } from "./dto/audit-log-response.dto";
import { ApiPaginatedResponse } from "../common/decorators/api-paginated-response.decorator";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";

@ApiTags("Audit Logs")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get audit logs (paginated, filterable by entity, action, actor, date range)",
  })
  @ApiPaginatedResponse(AuditLogResponseDto)
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/audit-logs",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/api/audit-logs",
    "Requires ADMIN or SUPER_ADMIN role",
  )
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditLogFilterDto,
  ) {
    return this.auditLogsService.findAll(user, query);
  }
}
