import { firstValueFrom, take } from "rxjs";
import { StatdashRealtimeService } from "./statdash-realtime.service";
import { RedisService } from "../../common/redis/redis.service";

describe("StatdashRealtimeService", () => {
  it("streams updates by session room key", async () => {
    const subscribeSessionUpdates = jest.fn().mockReturnValue(() => {});
    const publishSessionUpdate = jest.fn();
    const service = new StatdashRealtimeService({
      subscribeSessionUpdates,
      publishSessionUpdate,
    } as unknown as RedisService);
    service.onModuleInit();
    const eventPromise = firstValueFrom(
      service.streamBySession("session_1").pipe(take(1)),
    );

    service.publish({
      sessionId: "other_session",
      source: "command",
      state: { version: 1, score: { home: 0, away: 0 } },
      deltaEvents: [],
    });
    service.publish({
      sessionId: "session_1",
      source: "command",
      state: { version: 2, score: { home: 2, away: 0 } },
      deltaEvents: [{ eventType: "shot", sequence: 1 }],
    });

    const event = await eventPromise;
    expect(event.data).toEqual({
      sessionId: "session_1",
      source: "command",
      state: { version: 2, score: { home: 2, away: 0 } },
      deltaEvents: [{ eventType: "shot", sequence: 1 }],
    });
    expect(publishSessionUpdate).toHaveBeenCalledTimes(2);
  });

  it("replays missed updates using sinceVersion cursor", async () => {
    const service = new StatdashRealtimeService({
      subscribeSessionUpdates: jest.fn().mockReturnValue(() => {}),
      publishSessionUpdate: jest.fn(),
    } as unknown as RedisService);
    service.onModuleInit();
    service.publish({
      sessionId: "session_1",
      source: "command",
      state: { version: 1, score: { home: 2, away: 0 } },
      deltaEvents: [{ eventType: "shot", sequence: 1 }],
    });
    service.publish({
      sessionId: "session_1",
      source: "command",
      state: { version: 2, score: { home: 2, away: 2 } },
      deltaEvents: [{ eventType: "shot", sequence: 2 }],
    });

    const replayed = await firstValueFrom(
      service.streamBySession("session_1", 1).pipe(take(1)),
    );
    expect(replayed.data).toEqual({
      sessionId: "session_1",
      source: "command",
      state: { version: 2, score: { home: 2, away: 2 } },
      deltaEvents: [{ eventType: "shot", sequence: 2 }],
    });
  });

  it("consumes cross-instance updates from redis pubsub bridge", async () => {
    let handler: ((payload: unknown) => void) | undefined;
    const service = new StatdashRealtimeService({
      subscribeSessionUpdates: jest.fn().mockImplementation((h) => {
        handler = h;
        return () => {};
      }),
      publishSessionUpdate: jest.fn(),
    } as unknown as RedisService);
    service.onModuleInit();

    const eventPromise = firstValueFrom(
      service.streamBySession("session_1").pipe(take(1)),
    );
    handler?.({
      originNodeId: "other_node",
      update: {
        sessionId: "session_1",
        source: "command",
        state: { version: 3, score: { home: 4, away: 2 } },
        deltaEvents: [{ eventType: "shot", sequence: 3 }],
      },
    });
    const event = await eventPromise;
    expect(event.data).toEqual({
      sessionId: "session_1",
      source: "command",
      state: { version: 3, score: { home: 4, away: 2 } },
      deltaEvents: [{ eventType: "shot", sequence: 3 }],
    });
  });
});
