import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { QueueService } from "../../common/queue/queue.service";
import { StatdashProjectionsService } from "./statdash-projections.service";

@Controller("statdash/projections")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STATISTICIAN)
export class StatdashProjectionsController {
  constructor(
    private readonly statdashProjectionsService: StatdashProjectionsService,
    private readonly queueService: QueueService,
  ) {}

  @Get("match/:sessionId/box-score")
  getBoxScore(@Param("sessionId") sessionId: string) {
    return this.statdashProjectionsService.getBoxScore(sessionId);
  }

  @Get("match/:sessionId/shot-chart")
  getShotChart(@Param("sessionId") sessionId: string) {
    return this.statdashProjectionsService.getShotChart(sessionId);
  }

  @Get("player/:playerId/game/:sessionId")
  getPlayerGameProjection(
    @Param("playerId") playerId: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.statdashProjectionsService.getPlayerGameProjection(
      sessionId,
      playerId,
    );
  }

  @Get("match/:sessionId/summary")
  getSummary(@Param("sessionId") sessionId: string) {
    return this.statdashProjectionsService.getMatchSummary(sessionId);
  }

  @Post("match/:sessionId/rebuild")
  async rebuild(@Param("sessionId") sessionId: string) {
    await this.queueService.enqueueReplayBackfill(sessionId);
    return this.statdashProjectionsService.rebuildAndPersist(sessionId);
  }
}
