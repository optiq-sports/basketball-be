import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { QueueService } from "./queue.service";

@Controller("ops/queues")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get("health")
  getQueueHealth() {
    return this.queueService.getQueueHealth();
  }

  @Get("lag")
  getQueueLagMetrics() {
    return this.queueService.getQueueLagMetrics();
  }

  @Post("dead-letter/requeue")
  requeueDeadLetterJobs(@Query("limit") limit?: string) {
    const parsedLimit = Number(limit ?? "25");
    return this.queueService.requeueDeadLetterJobs(
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
    );
  }

  @Post("warm/session")
  warmSessionCaches(@Query("sessionId") sessionId: string) {
    return this.queueService.warmSessionCaches(sessionId);
  }
}
