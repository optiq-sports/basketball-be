import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MessageEvent } from "@nestjs/common";
import { Observable, concat, from, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";
import { RedisService } from "../../common/redis/redis.service";

type StatdashRealtimeUpdate = {
  sessionId: string;
  matchId?: string | null;
  source: "command" | "correction" | "reversal";
  state: {
    version: number;
    score: {
      home: number;
      away: number;
    };
  };
  deltaEvents: Array<{
    id?: string;
    sequence?: number;
    eventType?: string;
    createdAt?: Date | string;
  }>;
};

@Injectable()
export class StatdashRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly updates$ = new Subject<StatdashRealtimeUpdate>();
  private readonly historyBySession = new Map<
    string,
    StatdashRealtimeUpdate[]
  >();
  private static readonly MAX_HISTORY_PER_SESSION = 200;
  private readonly nodeId = `node_${Math.random().toString(36).slice(2)}`;
  private unsubscribe?: () => void;

  constructor(private readonly redisService: RedisService) {}

  onModuleInit() {
    this.unsubscribe = this.redisService.subscribeSessionUpdates((payload) => {
      const envelope = payload as
        { originNodeId?: string; update?: StatdashRealtimeUpdate } | undefined;
      if (!envelope?.update) return;
      if (envelope.originNodeId === this.nodeId) return;
      this.emitUpdate(envelope.update);
    });
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  streamBySession(
    sessionId: string,
    sinceVersion?: number,
  ): Observable<MessageEvent> {
    const replay = (this.historyBySession.get(sessionId) ?? []).filter(
      (update) =>
        typeof sinceVersion === "number"
          ? update.state.version > sinceVersion
          : true,
    );
    const live = this.updates$.pipe(
      filter((update) => update.sessionId === sessionId),
      map((update) => ({ type: "statdash-update", data: update })),
    );
    const replay$ = from(replay).pipe(
      map((update) => ({ type: "statdash-update", data: update })),
    );
    return concat(replay$, live);
  }

  publish(update: StatdashRealtimeUpdate) {
    this.emitUpdate(update);
    void this.redisService.publishSessionUpdate({
      originNodeId: this.nodeId,
      update,
    });
  }

  private emitUpdate(update: StatdashRealtimeUpdate) {
    const existing = this.historyBySession.get(update.sessionId) ?? [];
    existing.push(update);
    if (existing.length > StatdashRealtimeService.MAX_HISTORY_PER_SESSION) {
      existing.shift();
    }
    this.historyBySession.set(update.sessionId, existing);
    this.updates$.next(update);
  }
}
