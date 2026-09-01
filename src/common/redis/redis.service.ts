import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

type IdempotencyCacheValue = {
  requestHash: string;
  response: unknown;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly inMemory = new Map<
    string,
    { value: string; expiresAt?: number }
  >();
  private readonly redisClient?: Redis;
  private readonly redisSubscriber?: Redis;
  private readonly updateHandlers = new Set<(payload: unknown) => void>();

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn("REDIS_URL not set, using in-memory fallback cache");
      return;
    }

    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    this.redisSubscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    this.redisClient.on("error", (error) => {
      this.logger.warn(
        `Redis unavailable, falling back to memory cache: ${error.message}`,
      );
    });
    this.redisSubscriber.on("error", (error) => {
      this.logger.warn(
        `Redis subscriber unavailable, pub/sub fallback active: ${error.message}`,
      );
    });
    this.redisClient.connect().catch((error: Error) => {
      this.logger.warn(
        `Redis connect failed, using in-memory fallback: ${error.message}`,
      );
    });
    this.redisSubscriber
      .connect()
      .then(async () => {
        await this.redisSubscriber?.subscribe(this.realtimeUpdatesChannel());
        this.redisSubscriber?.on("message", (_channel, message) => {
          try {
            const payload = JSON.parse(message);
            for (const handler of this.updateHandlers) {
              handler(payload);
            }
          } catch {
            // Ignore malformed payloads from pub/sub channel
          }
        });
      })
      .catch((error: Error) => {
        this.logger.warn(
          `Redis subscriber connect failed, pub/sub fallback active: ${error.message}`,
        );
      });
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }
  }

  async publishSessionUpdate(payload: unknown) {
    if (this.redisClient?.status === "ready") {
      await this.redisClient.publish(
        this.realtimeUpdatesChannel(),
        JSON.stringify(payload),
      );
    }
  }

  subscribeSessionUpdates(handler: (payload: unknown) => void) {
    this.updateHandlers.add(handler);
    return () => {
      this.updateHandlers.delete(handler);
    };
  }

  async getSessionSnapshotCached(sessionId: string) {
    const raw = await this.getJson(this.sessionSnapshotKey(sessionId));
    return raw ?? null;
  }

  async setSessionSnapshotCached(
    sessionId: string,
    snapshot: unknown,
    ttlSec = 30,
  ) {
    await this.setJson(this.sessionSnapshotKey(sessionId), snapshot, ttlSec);
  }

  async invalidateSessionSnapshotCache(sessionId: string) {
    await this.del(this.sessionSnapshotKey(sessionId));
  }

  async getRecentEventsCached(sessionId: string) {
    const raw = await this.getJson(this.recentEventsKey(sessionId));
    return Array.isArray(raw) ? raw : null;
  }

  async setRecentEventsCached(
    sessionId: string,
    events: unknown[],
    ttlSec = 30,
  ) {
    await this.setJson(this.recentEventsKey(sessionId), events, ttlSec);
  }

  async appendRecentEventCache(sessionId: string, event: unknown, maxLen = 25) {
    const current = (await this.getRecentEventsCached(sessionId)) ?? [];
    current.push(event);
    const trimmed = current.slice(-maxLen);
    await this.setRecentEventsCached(sessionId, trimmed, 30);
  }

  async trimRecentEventsCache(sessionId: string, maxLen = 25) {
    const current = await this.getRecentEventsCached(sessionId);
    if (!current) return;
    await this.setRecentEventsCached(sessionId, current.slice(-maxLen), 30);
  }

  async getProjectionCached(sessionId: string, projectionType: string) {
    const raw = await this.getJson(
      this.projectionKey(sessionId, projectionType),
    );
    return raw ?? null;
  }

  async setProjectionCached(
    sessionId: string,
    projectionType: string,
    payload: unknown,
    ttlSec = 60,
  ) {
    await this.setJson(
      this.projectionKey(sessionId, projectionType),
      payload,
      ttlSec,
    );
  }

  async invalidateProjectionCache(sessionId: string, projectionType?: string) {
    if (projectionType) {
      await this.del(this.projectionKey(sessionId, projectionType));
      return;
    }
    const keys = ["box_score", "shot_chart", "summary"].map((type) =>
      this.projectionKey(sessionId, type),
    );
    await this.del(...keys);
  }

  async getIdempotencyResultCached(sessionId: string, key: string) {
    const raw = await this.getJson(this.idempotencyKey(sessionId, key));
    if (!raw || typeof raw !== "object") return null;
    return raw as IdempotencyCacheValue;
  }

  async setIdempotencyResultCached(
    sessionId: string,
    key: string,
    requestHash: string,
    response: unknown,
    ttlSec = 60 * 60 * 24,
  ) {
    await this.setJson(
      this.idempotencyKey(sessionId, key),
      { requestHash, response },
      ttlSec,
    );
  }

  async acquireSessionLock(sessionId: string, owner: string, ttlMs = 3000) {
    const lockKey = this.sessionLockKey(sessionId);
    if (this.redisClient?.status === "ready") {
      const result = await this.redisClient.set(
        lockKey,
        owner,
        "PX",
        ttlMs,
        "NX",
      );
      return result === "OK";
    }

    const now = Date.now();
    const existing = this.inMemory.get(lockKey);
    if (existing?.expiresAt && existing.expiresAt > now) {
      return false;
    }
    this.inMemory.set(lockKey, { value: owner, expiresAt: now + ttlMs });
    return true;
  }

  async releaseSessionLock(sessionId: string, owner: string) {
    const lockKey = this.sessionLockKey(sessionId);
    if (this.redisClient?.status === "ready") {
      const value = await this.redisClient.get(lockKey);
      if (value === owner) {
        await this.redisClient.del(lockKey);
      }
      return;
    }

    const existing = this.inMemory.get(lockKey);
    if (existing?.value === owner) {
      this.inMemory.delete(lockKey);
    }
  }

  private async getJson(key: string) {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private async setJson(key: string, value: unknown, ttlSec: number) {
    await this.set(key, JSON.stringify(value), ttlSec);
  }

  private async get(key: string) {
    if (this.redisClient?.status === "ready") {
      return this.redisClient.get(key);
    }
    const stored = this.inMemory.get(key);
    if (!stored) return null;
    if (stored.expiresAt && stored.expiresAt < Date.now()) {
      this.inMemory.delete(key);
      return null;
    }
    return stored.value;
  }

  private async set(key: string, value: string, ttlSec: number) {
    if (this.redisClient?.status === "ready") {
      await this.redisClient.set(key, value, "EX", ttlSec);
      return;
    }
    this.inMemory.set(key, {
      value,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  }

  private async del(...keys: string[]) {
    if (this.redisClient?.status === "ready") {
      await this.redisClient.del(...keys);
      return;
    }
    for (const key of keys) this.inMemory.delete(key);
  }

  private sessionSnapshotKey(sessionId: string) {
    return `statdash:session:${sessionId}:snapshot`;
  }

  private recentEventsKey(sessionId: string) {
    return `statdash:session:${sessionId}:recent_events`;
  }

  private projectionKey(sessionId: string, projectionType: string) {
    return `statdash:session:${sessionId}:projection:${projectionType}`;
  }

  private idempotencyKey(sessionId: string, key: string) {
    return `statdash:session:${sessionId}:idem:${key}`;
  }

  private sessionLockKey(sessionId: string) {
    return `statdash:session:${sessionId}:lock`;
  }

  private realtimeUpdatesChannel() {
    return "statdash:realtime:updates";
  }

  async checkHealth(): Promise<boolean> {
    if (!process.env.REDIS_URL) {
      return true; // Running in memory fallback mode, technically healthy
    }
    if (this.redisClient?.status === "ready") {
      try {
        await this.redisClient.ping();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
