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

    // Serverless hosts (e.g. Vercel) freeze between requests, causing jobs to stall.
    // Workers must run in a dedicated long-running process unless explicitly enabled.
    const isServerless =
      process.env.VERCEL === "1" ||
      Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    const workersExplicitlyEnabled =
      process.env.ENABLE_QUEUE_WORKERS === "true";
    const workersDisabled = process.env.DISABLE_QUEUE_WORKERS === "true";

    if (workersDisabled || (isServerless && !workersExplicitlyEnabled)) {
      this.logger.log(
        "Queue workers disabled in serverless/web process to prevent job stalling. Run workers in a dedicated process.",
      );
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

    // Default concurrency to 2 to stay safely within Prisma/DB connection pool limits (limit 5)
    const concurrency = Math.max(
      1,
      parseInt(process.env.QUEUE_CONCURRENCY || "2", 10),
    );

    this.workers.push(
      new Worker(
        "statdash-projections",
        async (job: Job) => this.handleProjectionJob(job),
        {
          connection: this.connection,
          concurrency,
          stalledInterval: 30000,
          maxStalledCount: 2,
        },
      ),
    );
    this.workers.push(
      new Worker(
        "statdash-recompute",
        async (job: Job) => this.handleRecomputeJob(job),
        {
          connection: this.connection,
          concurrency,
          stalledInterval: 30000,
          maxStalledCount: 2,
        },
      ),
    );
    this.workers.push(
      new Worker(
        "statdash-matchstat-sync",
        async (job: Job) => this.handleMatchStatSyncJob(job),
        {
          connection: this.connection,
          concurrency,
          stalledInterval: 30000,
          maxStalledCount: 2,
        },
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
      const projectionsService = this.moduleRef.get(
        StatdashProjectionsService,
        { strict: false },
      );
      await projectionsService.rebuildAndPersist(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to rebuild projections for session ${sessionId}: ${error}`,
      );
      throw error;
    }
  }

  private async handleRecomputeJob(job: Job) {
    const { sessionId } = (job.data ?? {}) as { sessionId?: string };
    if (!sessionId) return;
    await this.redisService.invalidateProjectionCache(sessionId);
    await this.redisService.invalidateSessionSnapshotCache(sessionId);
    try {
      const projectionsService = this.moduleRef.get(
        StatdashProjectionsService,
        { strict: false },
      );
      await projectionsService.rebuildAndPersist(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to rebuild projections for session ${sessionId}: ${error}`,
      );
      throw error;
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
      const projectionsService = this.moduleRef.get(
        StatdashProjectionsService,
        { strict: false },
      );
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
      throw error;
    }
  }
}
