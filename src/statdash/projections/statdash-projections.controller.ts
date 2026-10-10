import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { QueueService } from "../../common/queue/queue.service";
import { StatdashProjectionsService } from "./statdash-projections.service";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppErrorResponse } from "../../common/decorators/api-errors.decorator";
import {
  BoxScoreResponseDto,
  MatchSummaryResponseDto,
  PlayerProjectionDto,
  RebuildResponseDto,
  ShotChartEventDto,
  TimelineEventDto,
} from "./dto/statdash-projection-responses.dto";

@ApiTags("Statdash Projections")
@ApiBearerAuth()
@Controller("statdash/projections")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STATISTICIAN, Role.CLIENT)
export class StatdashProjectionsController {
  constructor(
    private readonly statdashProjectionsService: StatdashProjectionsService,
    private readonly queueService: QueueService,
  ) {}

  @Get("match/:sessionId/box-score")
  @ApiOperation({ summary: "Get the complete box score for a match session" })
  @ApiResponse({
    status: 200,
    description: "Box score retrieved successfully",
    type: BoxScoreResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/statdash/projections/match/:sessionId/box-score",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/statdash/projections/match/:sessionId/box-score",
    "Session does not exist",
  )
  getBoxScore(@Param("sessionId") sessionId: string, @CurrentUser() user: any) {
    return this.statdashProjectionsService.getBoxScore(sessionId, user);
  }

  @Get("match/:sessionId/shot-chart")
  @ApiOperation({ summary: "Get the shot chart events for a match session" })
  @ApiResponse({
    status: 200,
    description: "Shot chart retrieved successfully",
    type: [ShotChartEventDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/statdash/projections/match/:sessionId/shot-chart",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/statdash/projections/match/:sessionId/shot-chart",
    "Session does not exist",
  )
  getShotChart(
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: any,
  ) {
    return this.statdashProjectionsService.getShotChart(sessionId, user);
  }

  @Get("player/:playerId/game/:sessionId")
  @ApiOperation({ summary: "Get a specific player's game projection stats" })
  @ApiResponse({
    status: 200,
    description: "Player projection retrieved successfully",
    type: PlayerProjectionDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/statdash/projections/player/:playerId/game/:sessionId",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/statdash/projections/player/:playerId/game/:sessionId",
    "Session does not exist",
  )
  getPlayerGameProjection(
    @Param("playerId") playerId: string,
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: any,
  ) {
    return this.statdashProjectionsService.getPlayerGameProjection(
      sessionId,
      playerId,
      user,
    );
  }

  @Get("match/:sessionId/summary")
  @ApiOperation({ summary: "Get a high-level summary of a match session" })
  @ApiResponse({
    status: 200,
    description: "Summary retrieved successfully",
    type: MatchSummaryResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/statdash/projections/match/:sessionId/summary",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/statdash/projections/match/:sessionId/summary",
    "Session does not exist",
  )
  getSummary(@Param("sessionId") sessionId: string, @CurrentUser() user: any) {
    return this.statdashProjectionsService.getMatchSummary(sessionId, user);
  }

  @Get("match/:sessionId/timeline")
  @ApiOperation({ summary: "Get the play-by-play timeline for a match session" })
  @ApiResponse({
    status: 200,
    description: "Timeline retrieved successfully",
    type: [TimelineEventDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/statdash/projections/match/:sessionId/timeline",
    "Invalid or missing access token"
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/statdash/projections/match/:sessionId/timeline",
    "Session does not exist"
  )
  getTimeline(@Param("sessionId") sessionId: string, @CurrentUser() user: any) {
    return this.statdashProjectionsService.getTimeline(sessionId, user);
  }

  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @Post("match/:sessionId/rebuild")
  @ApiOperation({ summary: "Rebuild the box score projection from events" })
  @ApiResponse({
    status: 201,
    description: "Projection successfully rebuilt",
    type: RebuildResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/projections/match/:sessionId/rebuild",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/projections/match/:sessionId/rebuild",
    "Session does not exist",
  )
  async rebuild(
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: any,
  ) {
    await this.queueService.enqueueReplayBackfill(sessionId);
    return this.statdashProjectionsService.rebuildAndPersist(sessionId, user);
  }
}
