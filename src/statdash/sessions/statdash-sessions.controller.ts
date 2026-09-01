import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { BootstrapSessionDto } from "./dto/bootstrap-session.dto";
import { ResolveMatchKeyDto } from "./dto/resolve-match-key.dto";
import { StatdashSessionsService } from "./statdash-sessions.service";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppErrorResponse } from "../../common/decorators/api-errors.decorator";
import {
  ResolveMatchKeyResponseDto,
  StatdashSessionDto,
  StatdashSessionSnapshotDto,
} from "./dto/statdash-session-responses.dto";

@ApiTags("Statdash Sessions")
@ApiBearerAuth()
@Controller("statdash/sessions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.STATISTICIAN)
export class StatdashSessionsController {
  constructor(
    private readonly statdashSessionsService: StatdashSessionsService,
  ) {}

  @Post("resolve-match-key")
  @ApiOperation({
    summary: "Resolve a match key to an active match and session",
  })
  @ApiBody({ type: ResolveMatchKeyDto })
  @ApiResponse({
    status: 200,
    description: "Match successfully resolved",
    type: ResolveMatchKeyResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/statdash/sessions/resolve-match-key",
    "Invalid or ambiguous match key",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/sessions/resolve-match-key",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/sessions/resolve-match-key",
    "No match found for supplied match key",
  )
  resolveMatchKey(@Body() dto: ResolveMatchKeyDto) {
    return this.statdashSessionsService.resolveMatchKey(dto.matchKey);
  }

  @Post("bootstrap")
  @ApiOperation({ summary: "Bootstrap a game session state" })
  @ApiBody({ type: BootstrapSessionDto })
  @ApiResponse({
    status: 200,
    description: "Session successfully bootstrapped",
    type: StatdashSessionSnapshotDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/statdash/sessions/bootstrap",
    "Provide either matchId or sessionId",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/sessions/bootstrap",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/sessions/bootstrap",
    "Match or Session does not exist",
  )
  bootstrap(@Body() dto: BootstrapSessionDto) {
    return this.statdashSessionsService.bootstrap(dto);
  }

  @Post(":sessionId/start")
  @ApiOperation({ summary: "Start or resume a session" })
  @ApiResponse({
    status: 200,
    description: "Session successfully started",
    type: StatdashSessionDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/sessions/:sessionId/start",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/sessions/:sessionId/start",
    "Session does not exist",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/statdash/sessions/:sessionId/start",
    "Session cannot be started from current status",
  )
  startSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.startSession(sessionId);
  }

  @Get(":sessionId/state")
  @ApiOperation({ summary: "Get the current state of a session" })
  @ApiResponse({
    status: 200,
    description: "Returns the current session snapshot",
    type: StatdashSessionSnapshotDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/statdash/sessions/:sessionId/state",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/statdash/sessions/:sessionId/state",
    "Session does not exist",
  )
  getState(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.getState(sessionId);
  }

  @Post(":sessionId/pause")
  @ApiOperation({ summary: "Pause an active session" })
  @ApiResponse({
    status: 200,
    description: "Session successfully paused",
    type: StatdashSessionDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/sessions/:sessionId/pause",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/sessions/:sessionId/pause",
    "Session does not exist",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/statdash/sessions/:sessionId/pause",
    "Only in-progress sessions can be paused",
  )
  pauseSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.pauseSession(sessionId);
  }

  @Post(":sessionId/complete")
  @ApiOperation({ summary: "Complete a session" })
  @ApiResponse({
    status: 200,
    description: "Session successfully completed",
    type: StatdashSessionDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/sessions/:sessionId/complete",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/sessions/:sessionId/complete",
    "Session does not exist",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/statdash/sessions/:sessionId/complete",
    "Session is already completed or cancelled",
  )
  completeSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.completeSession(sessionId);
  }

  @Post(":sessionId/cancel")
  @ApiOperation({ summary: "Cancel a session" })
  @ApiResponse({
    status: 200,
    description: "Session successfully cancelled",
    type: StatdashSessionDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/sessions/:sessionId/cancel",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/sessions/:sessionId/cancel",
    "Session does not exist",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/statdash/sessions/:sessionId/cancel",
    "Session is already completed or cancelled",
  )
  cancelSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.cancelSession(sessionId);
  }
}
