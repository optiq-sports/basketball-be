import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Job, Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { QueueService } from "./queue.service";
import { StatdashProjectionsService } from "../../statdash/projections/statdash-projections.service";

@Injectable()
export class QueueWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerService.name);
  private readonly connection?: IORedis;
  private readonly workers: Worker[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly moduleRef: ModuleRef,
  ) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return;
    }

    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.bootstrapWorkers();
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await this.connection?.quit();
  }

  private bootstrapWorkers() {
    if (!this.connection) return;

    this.workers.push(
      new Worker(
        "statdash-projections",
        async (job: Job) => this.handleProjectionJob(job),
        { connection: this.connection, concurrency: 5 },
      ),
    );
    this.workers.push(
      new Worker(
        "statdash-recompute",
        async (job: Job) => this.handleRecomputeJob(job),
        { connection: this.connection, concurrency: 5 },
      ),
    );
    this.workers.push(
      new Worker(
        "statdash-matchstat-sync",
        async (job: Job) => this.handleMatchStatSyncJob(job),
        { connection: this.connection, concurrency: 5 },
      ),
    );

    for (const worker of this.workers) {
      worker.on("failed", async (job, error) => {
        if (!job) return;
        await this.queueService.pushToDeadLetter({
          queueName: worker.name,
          jobName: job.name,
          data: (job.data ?? {}) as Record<string, unknown>,
          failedReason: error?.message ?? "unknown",
        });
      });
    }
  }

  private async handleProjectionJob(job: Job) {
    const { sessionId } = (job.data ?? {}) as { sessionId?: string };
    if (!sessionId) return;
    await this.redisService.invalidateProjectionCache(sessionId);
    await this.redisService.invalidateSessionSnapshotCache(sessionId);
    try {
      const projectionsService = this.moduleRef.get(StatdashProjectionsService, { strict: false });
      await projectionsService.rebuildAndPersist(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to rebuild projections for session ${sessionId}: ${error}`,
      );
    }
  }

  private async handleRecomputeJob(job: Job) {
    const { sessionId } = (job.data ?? {}) as { sessionId?: string };
    if (!sessionId) return;
    await this.redisService.invalidateProjectionCache(sessionId);
    await this.redisService.invalidateSessionSnapshotCache(sessionId);
    try {
      const projectionsService = this.moduleRef.get(StatdashProjectionsService, { strict: false });
      await projectionsService.rebuildAndPersist(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to rebuild projections for session ${sessionId}: ${error}`,
      );
    }
  }

  private async handleMatchStatSyncJob(job: Job) {
    const { sessionId } = (job.data ?? {}) as { sessionId?: string };
    if (!sessionId) return;
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { matchId: true },
    });
    if (!session) return;
    try {
      const projectionsService = this.moduleRef.get(StatdashProjectionsService, { strict: false });
      await projectionsService.rebuildAndPersist(sessionId);
      this.logger.log(
        JSON.stringify({
          event: "queue.matchstat.sync.completed",
          sessionId,
          matchId: session.matchId,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync match stats for session ${sessionId}: ${error}`,
      );
    }
  }
}
