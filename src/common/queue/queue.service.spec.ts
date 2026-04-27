import { QueueService } from "./queue.service";

describe("QueueService", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it("no-ops safely when redis url is not configured", async () => {
    delete process.env.REDIS_URL;
    const service = new QueueService();

    await expect(
      service.enqueueProjectionRebuild("session_1", "test"),
    ).resolves.toBeUndefined();
    await expect(service.enqueueMatchStatSync("session_1")).resolves.toBeUndefined();
    await expect(
      service.enqueueCorrectionRecompute("session_1", "event_1", "correction"),
    ).resolves.toBeUndefined();
    await expect(service.enqueueReplayBackfill("session_1")).resolves.toBeUndefined();
    await expect(service.enqueueDeadLetterRecovery({ foo: "bar" })).resolves.toBeUndefined();
    await expect(service.pushToDeadLetter({
      queueName: "statdash-projections",
      jobName: "projection.rebuild",
      data: { sessionId: "session_1" },
      failedReason: "x",
    })).resolves.toBeUndefined();
    await expect(service.getQueueHealth()).resolves.toEqual({
      enabled: false,
      queues: {},
    });
    await expect(service.getQueueLagMetrics()).resolves.toEqual({
      enabled: false,
      lag: {},
    });
    await expect(service.requeueDeadLetterJobs()).resolves.toEqual({ requeued: 0 });
    await expect(service.warmSessionCaches("session_1")).resolves.toEqual({
      warmed: true,
      sessionId: "session_1",
    });
  });
});
