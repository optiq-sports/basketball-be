import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { QueueService } from "./queue.service";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AppErrorResponse } from "../decorators/api-errors.decorator";
import { RequeueDeadLetterQueryDto, WarmSessionQueryDto } from "./dto/queue-requests.dto";
import {
  QueueHealthResponseDto,
  QueueLagResponseDto,
  RequeueDeadLetterResponseDto,
  WarmSessionResponseDto,
} from "./dto/queue-responses.dto";

@ApiTags("Ops Queues")
@ApiBearerAuth()
@Controller("ops/queues")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get("health")
  @ApiOperation({ summary: "Get health and job counts of the Redis queues" })
  @ApiResponse({ status: 200, description: "Queue health retrieved", type: QueueHealthResponseDto })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/ops/queues/health", "Invalid or missing access token")
  getQueueHealth() {
    return this.queueService.getQueueHealth();
  }

  @Get("lag")
  @ApiOperation({ summary: "Get lag metrics for the Redis queues" })
  @ApiResponse({ status: 200, description: "Queue lag metrics retrieved", type: QueueLagResponseDto })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/ops/queues/lag", "Invalid or missing access token")
  getQueueLagMetrics() {
    return this.queueService.getQueueLagMetrics();
  }

  @Post("dead-letter/requeue")
  @ApiOperation({ summary: "Requeue failed jobs from the Dead Letter Queue" })
  @ApiResponse({ status: 201, description: "Jobs requeued successfully", type: RequeueDeadLetterResponseDto })
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/ops/queues/dead-letter/requeue", "Invalid or missing access token")
  requeueDeadLetterJobs(@Query() query: RequeueDeadLetterQueryDto) {
    const parsedLimit = Number(query.limit ?? "25");
    return this.queueService.requeueDeadLetterJobs(
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25,
    );
  }

  @Post("warm/session")
  @ApiOperation({ summary: "Warm cache and queues for a specific session" })
  @ApiResponse({ status: 201, description: "Session caches warmed", type: WarmSessionResponseDto })
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/ops/queues/warm/session", "Invalid or missing access token")
  warmSessionCaches(@Query() query: WarmSessionQueryDto) {
    return this.queueService.warmSessionCaches(query.sessionId);
  }
}
