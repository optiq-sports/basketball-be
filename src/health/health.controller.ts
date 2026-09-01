// src/health/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  HealthCheckError,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private memory: MemoryHealthIndicator,
    private redisService: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: "Check the health of the application and its dependencies",
  })
  @ApiResponse({
    status: 200,
    description: "The application is healthy",
    type: HealthResponseDto,
  })
  @AppErrorResponse(
    503,
    "Service Unavailable",
    "GET",
    "/api/health",
    "One or more health checks failed (e.g., database, redis, memory)",
  )
  check() {
    return this.health.check([
      // Database health check
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: "up" } };
        } catch (error) {
          throw new HealthCheckError("Database check failed", {
            database: { status: "down" },
          });
        }
      },
      // Redis health check
      async () => {
        const isHealthy = await this.redisService.checkHealth();
        if (isHealthy) {
          return { redis: { status: "up" } };
        } else {
          throw new HealthCheckError("Redis check failed", {
            redis: { status: "down" },
          });
        }
      },
      // Memory health check (Fail if > 300MB RSS)
      () => this.memory.checkRSS("memory_rss", 300 * 1024 * 1024),
    ]);
  }
}
