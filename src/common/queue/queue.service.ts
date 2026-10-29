import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { JobsOptions, Queue } from "bullmq";
import IORedis from "ioredis";

type QueuePayload = Record<string, unknown>;
type QueueName =
  | "statdash-projections"
  | "statdash-recompute"
  | "statdash-matchstat-sync";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection?: IORedis;
  private readonly projectionQueue?: Queue<QueuePayload>;
  private readonly recomputeQueue?: Queue<QueuePayload>;
  private readonly matchStatSyncQueue?: Queue<QueuePayload>;
  private readonly deadLetterQueue?: Queue<QueuePayload>;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn("REDIS_URL not set, BullMQ queueing is disabled");
      return;
    }

    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.projectionQueue = new Queue("statdash-projections", {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: { count: 100, age: 86400 },
      },
    });
    this.recomputeQueue = new Queue("statdash-recompute", {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: { count: 100, age: 86400 },
      },
    });
    this.matchStatSyncQueue = new Queue("statdash-matchstat-sync", {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: { count: 100, age: 86400 },
      },
    });
    this.deadLetterQueue = new Queue("statdash-dlq", {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100, age: 86400 },
      },
    });
  }

  getQueues(): Queue[] {
    return [
      this.projectionQueue,
      this.recomputeQueue,
      this.matchStatSyncQueue,
      this.deadLetterQueue,
    ].filter(Boolean) as Queue[];
  }

  async onModuleDestroy() {
    await Promise.all([
      this.projectionQueue?.close(),
      this.recomputeQueue?.close(),
      this.matchStatSyncQueue?.close(),
      this.deadLetterQueue?.close(),
    ]);
    await this.connection?.quit();
  }

  async enqueueProjectionRebuild(
    sessionId: string,
    reason: string,
    dedupKey?: string,
  ) {
    if (!this.projectionQueue) return;
    await this.projectionQueue.add(
      "projection.rebuild",
      { sessionId, reason },
      this.withJobPolicy({
        jobId: `projection:${sessionId}:${dedupKey ?? "latest"}`,
      }),
    );
  }

  async enqueueMatchStatSync(sessionId: string, dedupKey?: string) {
    if (!this.matchStatSyncQueue) return;
    await this.matchStatSyncQueue.add(
      "matchstat.sync",
      { sessionId },
      this.withJobPolicy({
        jobId: `matchstat:${sessionId}:${dedupKey ?? "latest"}`,
      }),
    );
  }

  async enqueueCorrectionRecompute(
    sessionId: string,
    eventId: string,
    operation: "correction" | "reversal",
    dedupKey?: string,
  ) {
    if (!this.recomputeQueue) return;
    await this.recomputeQueue.add(
      "session.recompute",
      { sessionId, eventId, operation },
      this.withJobPolicy({
        jobId: `recompute:${operation}:${eventId}:${dedupKey ?? "latest"}`,
      }),
    );
  }

  async enqueueReplayBackfill(
    sessionId: string,
    fromSequence?: number,
    dedupKey?: string,
  ) {
    if (!this.recomputeQueue) return;
    await this.recomputeQueue.add(
      "session.replay.backfill",
      { sessionId, fromSequence: fromSequence ?? null },
      this.withJobPolicy({
        jobId: `replay:${sessionId}:${dedupKey ?? "latest"}`,
      }),
    );
  }

  async enqueueDeadLetterRecovery(payload: QueuePayload) {
    if (!this.deadLetterQueue) return;
    await this.deadLetterQueue.add(
      "dlq.recovery",
      payload,
      this.withJobPolicy({}),
    );
  }

  async pushToDeadLetter(payload: {
    queueName: string;
    jobName: string;
    data: QueuePayload;
    failedReason: string;
  }) {
    await this.enqueueDeadLetterRecovery({
      ...payload,
      failedAt: new Date().toISOString(),
    });
  }

  async getQueueHealth() {
    if (!this.connection) {
      return {
        enabled: false,
        queues: {},
      };
    }
    const [projection, recompute, matchStat, dlq] = await Promise.all([
      this.projectionQueue?.getJobCounts(),
      this.recomputeQueue?.getJobCounts(),
      this.matchStatSyncQueue?.getJobCounts(),
      this.deadLetterQueue?.getJobCounts(),
    ]);
    return {
      enabled: true,
      queues: {
        "statdash-projections": projection ?? {},
        "statdash-recompute": recompute ?? {},
        "statdash-matchstat-sync": matchStat ?? {},
        "statdash-dlq": dlq ?? {},
      },
    };
  }

  async getQueueLagMetrics() {
    if (!this.connection) {
      return {
        enabled: false,
        lag: {},
      };
    }
    const [projection, recompute, matchStat] = await Promise.all([
      this.getLagForQueue(this.projectionQueue),
      this.getLagForQueue(this.recomputeQueue),
      this.getLagForQueue(this.matchStatSyncQueue),
    ]);
    return {
      enabled: true,
      lag: {
        "statdash-projections": projection,
        "statdash-recompute": recompute,
        "statdash-matchstat-sync": matchStat,
      },
    };
  }

  async requeueDeadLetterJobs(limit = 25) {
    if (!this.deadLetterQueue) return { enabled: false, requeued: 0 };
    const jobs = await this.deadLetterQueue.getJobs(
      ["waiting", "failed"],
      0,
      limit - 1,
    );
    let requeued = 0;
    for (const job of jobs) {
      const payload = (job.data ?? {}) as {
        queueName?: QueueName;
        jobName?: string;
        data?: QueuePayload;
      };
      if (!payload.queueName || !payload.jobName || !payload.data) {
        continue;
      }
      const queue = this.resolveQueue(payload.queueName);
      if (!queue) continue;
      await queue.add(payload.jobName, payload.data, this.withJobPolicy({}));
      await job.remove();
      requeued += 1;
    }
    return { enabled: true, requeued };
  }

  async getDeadLetterJobs(limit = 25, offset = 0) {
    if (!this.deadLetterQueue) {
      return {
        enabled: false,
        total: 0,
        jobs: [],
      };
    }
    const [total, jobs] = await Promise.all([
      this.deadLetterQueue.count(),
      this.deadLetterQueue.getJobs(
        ["waiting", "failed", "completed"],
        offset,
        offset + limit - 1,
      ),
    ]);
    return {
      enabled: true,
      total,
      jobs: jobs.map((job) => {
        const payloadData = (job.data ?? {}) as Record<string, unknown>;
        const innerData = (payloadData.data ?? {}) as Record<string, unknown>;
        return {
          id: job.id ?? "unknown",
          name: job.name,
          queueName: (payloadData.queueName as string | undefined) ?? "unknown",
          sessionId:
            (innerData.sessionId as string | undefined) ??
            (payloadData.sessionId as string | undefined),
          timestamp: job.timestamp,
          failedReason:
            job.failedReason ||
            (payloadData.failedReason as string | undefined) ||
            "unknown",
          attemptsMade: job.attemptsMade,
          data: payloadData,
        };
      }),
    };
  }

  async warmSessionCaches(sessionId: string) {
    if (!this.connection) {
      return {
        enabled: false,
        warmed: false,
        sessionId,
      };
    }
    await Promise.all([
      this.enqueueProjectionRebuild(sessionId, "warm_cache", "warm"),
      this.enqueueReplayBackfill(sessionId, undefined, "warm"),
      this.enqueueMatchStatSync(sessionId, "warm"),
    ]);
    return {
      enabled: true,
      warmed: true,
      sessionId,
    };
  }

  private resolveQueue(queueName: QueueName) {
    switch (queueName) {
      case "statdash-projections":
        return this.projectionQueue;
      case "statdash-recompute":
        return this.recomputeQueue;
      case "statdash-matchstat-sync":
        return this.matchStatSyncQueue;
      default:
        return undefined;
    }
  }

  private withJobPolicy(options: JobsOptions): JobsOptions {
    return {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: { count: 100, age: 86400 },
      removeOnFail: false,
      ...options,
    };
  }

  private async getLagForQueue(queue?: Queue<QueuePayload>) {
    if (!queue) return { oldestWaitingMs: 0, waiting: 0 };
    const jobs = await queue.getJobs(["waiting"], 0, 19);
    const now = Date.now();
    const oldest = jobs.reduce<number | null>((acc, job) => {
      if (!job.timestamp) return acc;
      return acc === null ? job.timestamp : Math.min(acc, job.timestamp);
    }, null);
    return {
      waiting: jobs.length,
      oldestWaitingMs: oldest ? Math.max(now - oldest, 0) : 0,
    };
  }
}
