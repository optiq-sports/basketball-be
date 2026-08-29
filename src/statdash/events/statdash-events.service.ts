import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { QueueService } from "../../common/queue/queue.service";
import { StatdashProjectionsService } from "../projections/statdash-projections.service";
import { StatdashRealtimeService } from "../realtime/statdash-realtime.service";
import { CorrectEventDto } from "./dto/correct-event.dto";
import { ReverseEventDto } from "./dto/reverse-event.dto";
import { StatdashCommandDto } from "./dto/statdash-command.dto";
import { validateCommandPayload } from "./dto/validate-command-payload";
import {
  applyCommandRules,
  assertExpectedVersion,
} from "./rules/statdash-rule-engine";
import { validateOnCourtPlayer } from "./rules/lineup-validation.rules";

type CommandResult = {
  sessionId: string;
  version: number;
  score: {
    home: number;
    away: number;
  };
  emittedEvents: Array<{
    id: string;
    sequence: number;
    eventType: string;
    createdAt: Date;
  }>;
};

type CorrectionOrReversalResult = {
  sessionId: string;
  version: number;
  score: {
    home: number;
    away: number;
  };
  correctedEventId?: string;
  reversedEventId?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type StatdashTxClient = Prisma.TransactionClient & {
  gameSession: {
    findUnique: (...args: any[]) => any;
    update: (...args: any[]) => any;
  };
  gameEvent: {
    aggregate: (...args: any[]) => any;
    create: (...args: any[]) => any;
    findUnique: (...args: any[]) => any;
    findMany: (...args: any[]) => any;
  };
  idempotencyRecord: {
    findUnique: (...args: any[]) => any;
    create: (...args: any[]) => any;
  };
  lineupState: {
    findFirst: (...args: any[]) => any;
    create: (...args: any[]) => any;
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Neon / serverless DB can exceed Prisma's default ~5s interactive transaction cap. */
const STATDASH_COMMAND_TX_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
} as const;

@Injectable()
export class StatdashEventsService {
  private readonly logger = new Logger(StatdashEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly statdashProjectionsService: StatdashProjectionsService,
    private readonly statdashRealtimeService: StatdashRealtimeService,
  ) {}

  async handleCommand(command: StatdashCommandDto, actorUserId: string) {
    validateCommandPayload(command.commandType, command.payload);
    const requestHash = this.hashRequest(command);
    const lockOwner = `${actorUserId}:${command.idempotencyKey}`;

    const cachedIdempotency = await this.redisService.getIdempotencyResultCached(
      command.sessionId,
      command.idempotencyKey,
    );
    if (cachedIdempotency) {
      if (cachedIdempotency.requestHash !== requestHash) {
        throw new ConflictException({
          code: "SD_IDEMPOTENCY_KEY_REUSED_DIFFERENT_REQUEST",
          message:
            "idempotencyKey already exists for a different request payload",
        });
      }
      return cachedIdempotency.response as CommandResult;
    }
    const lockAcquired = await this.redisService.acquireSessionLock(
      command.sessionId,
      lockOwner,
      5000,
    );
    if (!lockAcquired) {
      throw new ConflictException({
        code: "SD_SESSION_LOCK_BUSY",
        message: "Session is currently processing another command",
      });
    }
    try {
      const response = await this.prisma.$transaction(
        async (tx: StatdashTxClient) => {
      const session = await tx.gameSession.findUnique({
        where: { id: command.sessionId },
        include: { match: true },
      });
      if (!session) {
        throw new NotFoundException({
          code: "SD_SESSION_NOT_FOUND",
          message: "Session does not exist",
        });
      }
      const existingIdempotency = await tx.idempotencyRecord.findUnique({
        where: {
          sessionId_key: {
            sessionId: command.sessionId,
            key: command.idempotencyKey,
          },
        },
      });
      if (existingIdempotency) {
        if (existingIdempotency.requestHash && existingIdempotency.requestHash !== requestHash) {
          throw new ConflictException({
            code: "SD_IDEMPOTENCY_KEY_REUSED_DIFFERENT_REQUEST",
            message:
              "idempotencyKey already exists for a different request payload",
          });
        }
        this.logger.log(
          JSON.stringify({
            event: "statdash.idempotency.hit",
            sessionId: command.sessionId,
            idempotencyKey: command.idempotencyKey,
          }),
        );
        return existingIdempotency.responseSnapshot as unknown as CommandResult;
      }

      try {
        assertExpectedVersion(session.version, command.expectedVersion);
      } catch {
        this.logger.warn(
          JSON.stringify({
            event: "statdash.version.conflict",
            sessionId: command.sessionId,
            expectedVersion: command.expectedVersion,
            actualVersion: session.version,
          }),
        );
        throw new ConflictException({
          code: "SD_VERSION_CONFLICT",
          message: `Stale version. Expected ${command.expectedVersion}, latest is ${session.version}`,
          latestVersion: session.version,
        });
      }

      const latestLineup = await tx.lineupState.findFirst({
        where: { sessionId: session.id },
        orderBy: { capturedAt: "desc" },
      });
      const lineupSnapshot = latestLineup
        ? {
            homeLineup: (latestLineup.homeLineup as string[]) ?? [],
            awayLineup: (latestLineup.awayLineup as string[]) ?? [],
          }
        : null;

      const actorPlayerFields = [
        "playerId",
        "shooterPlayerId",
        "assistedPlayerId",
        "blockerPlayerId",
        "againstPlayerId",
        "foulerPlayerId",
        "fouledPlayerId",
        "playerOutId",
        "playerInId",
      ] as const;

      for (const field of actorPlayerFields) {
        const candidate = command.payload[field];
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          validateOnCourtPlayer(
            lineupSnapshot,
            candidate,
            "SD_LINEUP_PLAYER_NOT_ON_COURT",
          );
        }
      }

      const ruleResult = applyCommandRules(command.commandType, command.payload, {
        session: {
          id: session.id,
          matchId: session.matchId,
          homeScore: session.homeScore,
          awayScore: session.awayScore,
          match: {
            homeTeamId: session.match.homeTeamId,
            awayTeamId: session.match.awayTeamId,
          },
        },
        lineupSnapshot,
      });

      const currentMax = await tx.gameEvent.aggregate({
        where: { sessionId: session.id },
        _max: { sequence: true },
      });
      let nextSequence = (currentMax._max.sequence ?? 0) + 1;

      const emittedEvents = [];
      const batchSize = ruleResult.emittedEvents.length;
      for (let i = 0; i < batchSize; i += 1) {
        const draft = ruleResult.emittedEvents[i];
        const event = await tx.gameEvent.create({
          data: {
            sessionId: session.id,
            sequence: nextSequence,
            eventType: draft.eventType,
            payload: draft.payload as Prisma.InputJsonValue,
            actorUserId,
            expectedVersion: command.expectedVersion,
            resultingVersion: command.expectedVersion + i + 1,
          },
        });
        emittedEvents.push(event);
        nextSequence += 1;
      }

      const resultingVersion = command.expectedVersion + batchSize;
      const updatedSession = await tx.gameSession.update({
        where: { id: session.id },
        data: {
          version: resultingVersion,
          homeScore: session.homeScore + ruleResult.scoreDelta.home,
          awayScore: session.awayScore + ruleResult.scoreDelta.away,
          quarter: ruleResult.sessionUpdates?.quarter !== undefined ? ruleResult.sessionUpdates.quarter : undefined,
          clockSecondsRemaining: ruleResult.sessionUpdates?.clockSecondsRemaining !== undefined ? ruleResult.sessionUpdates.clockSecondsRemaining : undefined,
          possessionTeamId: ruleResult.sessionUpdates?.possessionTeamId !== undefined ? ruleResult.sessionUpdates.possessionTeamId : undefined,
          jumpBallWinnerTeamId: ruleResult.sessionUpdates?.jumpBallWinnerTeamId !== undefined ? ruleResult.sessionUpdates.jumpBallWinnerTeamId : undefined,
        },
      });

      if (ruleResult.newLineup) {
        await tx.lineupState.create({
          data: {
            sessionId: session.id,
            quarter: ruleResult.sessionUpdates?.quarter ?? session.quarter,
            homeLineup: ruleResult.newLineup.homeLineup,
            awayLineup: ruleResult.newLineup.awayLineup,
          }
        });
      }

      const response: CommandResult = {
        sessionId: updatedSession.id,
        version: updatedSession.version,
        score: {
          home: updatedSession.homeScore,
          away: updatedSession.awayScore,
        },
        emittedEvents: emittedEvents.map((event) => ({
          id: event.id,
          sequence: event.sequence,
          eventType: event.eventType,
          createdAt: event.createdAt,
        })),
      };

      await tx.idempotencyRecord.create({
        data: {
          key: command.idempotencyKey,
          sessionId: command.sessionId,
          requestHash,
          commandType: command.commandType,
          responseSnapshot: response as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        },
      });

      this.logger.log(
        JSON.stringify({
          event: "statdash.command.applied",
          sessionId: command.sessionId,
          commandType: command.commandType,
          expectedVersion: command.expectedVersion,
          resultingVersion,
          emittedCount: emittedEvents.length,
        }),
      );

      return response;
      },
      STATDASH_COMMAND_TX_OPTIONS,
    );

      try {
        if (Array.isArray(response.emittedEvents) && response.emittedEvents.length > 0) {
          this.statdashRealtimeService.publish({
            sessionId: response.sessionId,
            source: "command",
            state: {
              version: response.version,
              score: response.score,
            },
            deltaEvents: response.emittedEvents,
          });
        }

        await Promise.all([
          this.redisService.setIdempotencyResultCached(
            command.sessionId,
            command.idempotencyKey,
            requestHash,
            response,
          ),
          this.redisService.invalidateSessionSnapshotCache(command.sessionId),
          this.redisService.invalidateProjectionCache(command.sessionId),
          this.queueService.enqueueProjectionRebuild(
            command.sessionId,
            "command_write",
            `${response.version}`,
          ),
          this.queueService.enqueueMatchStatSync(
            command.sessionId,
            `${response.version}`,
          ),
        ]);

        if (Array.isArray(response.emittedEvents)) {
          for (const event of response.emittedEvents) {
            await this.redisService.appendRecentEventCache(
              command.sessionId,
              event,
              25,
            );
          }
        }
      } catch (sideEffectErr) {
        this.logger.error(
          JSON.stringify({
            event: "statdash.command.side_effects_failed",
            sessionId: command.sessionId,
            commandType: command.commandType,
            message:
              sideEffectErr instanceof Error ? sideEffectErr.message : String(sideEffectErr),
          }),
          sideEffectErr instanceof Error ? sideEffectErr.stack : undefined,
        );
      }

      return response;
    } finally {
      await this.redisService.releaseSessionLock(command.sessionId, lockOwner);
    }
  }

  async correctEvent(eventId: string, dto: CorrectEventDto, actorUserId: string) {
    const response = await this.prisma.$transaction(
      async (tx: StatdashTxClient) => {
      const targetEvent = await tx.gameEvent.findUnique({
        where: { id: eventId },
      });
      if (!targetEvent) {
        throw new NotFoundException({
          code: "SD_EVENT_NOT_FOUND",
          message: "Target event does not exist",
        });
      }
      if (targetEvent.eventType === "correction" || targetEvent.eventType === "reversal") {
        throw new BadRequestException({
          code: "SD_EVENT_CORRECTION_INVALID_TARGET",
          message: "Cannot correct correction/reversal events",
        });
      }

      const maxSequence = await tx.gameEvent.aggregate({
        where: { sessionId: targetEvent.sessionId },
        _max: { sequence: true },
      });
      const nextSequence = (maxSequence._max.sequence ?? 0) + 1;

      await tx.gameEvent.create({
        data: {
          sessionId: targetEvent.sessionId,
          sequence: nextSequence,
          eventType: "correction",
          payload: {
            targetEventId: targetEvent.id,
            originalEventType: targetEvent.eventType,
            correctedPayload: dto.correctedPayload,
            reason: dto.reason,
            audit: {
              createdBy: actorUserId,
              updatedBy: actorUserId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
          actorUserId,
          expectedVersion: targetEvent.resultingVersion,
          resultingVersion: targetEvent.resultingVersion + 1,
        },
      });

      const events = await tx.gameEvent.findMany({
        where: { sessionId: targetEvent.sessionId },
        orderBy: { sequence: "asc" },
      });
      const resolvedEvents = this.statdashProjectionsService.resolveEvents(events);
      const replay = this.statdashProjectionsService.replayScoreFromEvents(resolvedEvents, events.length);
      const updatedSession = await tx.gameSession.update({
        where: { id: targetEvent.sessionId },
        data: {
          homeScore: replay.homeScore,
          awayScore: replay.awayScore,
          quarter: replay.quarter,
          clockSecondsRemaining: replay.clockSecondsRemaining,
          possessionTeamId: replay.possessionTeamId,
          jumpBallWinnerTeamId: replay.jumpBallWinnerTeamId,
          version: replay.version,
        },
      });

      const response: CorrectionOrReversalResult = {
        sessionId: updatedSession.id,
        version: updatedSession.version,
        score: {
          home: updatedSession.homeScore,
          away: updatedSession.awayScore,
        },
        correctedEventId: targetEvent.id,
      };
      return response;
    },
    STATDASH_COMMAND_TX_OPTIONS,
    );

    try {
      this.statdashRealtimeService.publish({
        sessionId: response.sessionId,
        source: "correction",
        state: {
          version: response.version,
          score: response.score,
        },
        deltaEvents: [
          {
            eventType: "correction",
          },
        ],
      });

      await Promise.all([
        this.redisService.invalidateSessionSnapshotCache(response.sessionId),
        this.redisService.invalidateProjectionCache(response.sessionId),
        this.queueService.enqueueCorrectionRecompute(
          response.sessionId,
          response.correctedEventId ?? eventId,
          "correction",
          `${response.version}`,
        ),
      ]);
    } catch (sideEffectErr) {
      this.logger.error(
        JSON.stringify({
          event: "statdash.correction.side_effects_failed",
          sessionId: response.sessionId,
          eventId,
          message:
            sideEffectErr instanceof Error ? sideEffectErr.message : String(sideEffectErr),
        }),
        sideEffectErr instanceof Error ? sideEffectErr.stack : undefined,
      );
    }

    return response;
  }

  async reverseEvent(eventId: string, dto: ReverseEventDto, actorUserId: string) {
    const response = await this.prisma.$transaction(
      async (tx: StatdashTxClient) => {
      const targetEvent = await tx.gameEvent.findUnique({
        where: { id: eventId },
      });
      if (!targetEvent) {
        throw new NotFoundException({
          code: "SD_EVENT_NOT_FOUND",
          message: "Target event does not exist",
        });
      }

      const maxSequence = await tx.gameEvent.aggregate({
        where: { sessionId: targetEvent.sessionId },
        _max: { sequence: true },
      });
      const nextSequence = (maxSequence._max.sequence ?? 0) + 1;

      await tx.gameEvent.create({
        data: {
          sessionId: targetEvent.sessionId,
          sequence: nextSequence,
          eventType: "reversal",
          payload: {
            reversedEventId: targetEvent.id,
            originalEventType: targetEvent.eventType,
            reason: dto.reason,
            audit: {
              createdBy: actorUserId,
              updatedBy: actorUserId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
          actorUserId,
          expectedVersion: targetEvent.resultingVersion,
          resultingVersion: targetEvent.resultingVersion + 1,
        },
      });

      const events = await tx.gameEvent.findMany({
        where: { sessionId: targetEvent.sessionId },
        orderBy: { sequence: "asc" },
      });
      const resolvedEvents = this.statdashProjectionsService.resolveEvents(events);
      const replay = this.statdashProjectionsService.replayScoreFromEvents(resolvedEvents, events.length);
      const updatedSession = await tx.gameSession.update({
        where: { id: targetEvent.sessionId },
        data: {
          homeScore: replay.homeScore,
          awayScore: replay.awayScore,
          quarter: replay.quarter,
          clockSecondsRemaining: replay.clockSecondsRemaining,
          possessionTeamId: replay.possessionTeamId,
          jumpBallWinnerTeamId: replay.jumpBallWinnerTeamId,
          version: replay.version,
        },
      });

      const response: CorrectionOrReversalResult = {
        sessionId: updatedSession.id,
        version: updatedSession.version,
        score: {
          home: updatedSession.homeScore,
          away: updatedSession.awayScore,
        },
        reversedEventId: targetEvent.id,
      };
      return response;
    },
    STATDASH_COMMAND_TX_OPTIONS,
    );

    try {
      this.statdashRealtimeService.publish({
        sessionId: response.sessionId,
        source: "reversal",
        state: {
          version: response.version,
          score: response.score,
        },
        deltaEvents: [
          {
            eventType: "reversal",
          },
        ],
      });

      await Promise.all([
        this.redisService.invalidateSessionSnapshotCache(response.sessionId),
        this.redisService.invalidateProjectionCache(response.sessionId),
        this.queueService.enqueueCorrectionRecompute(
          response.sessionId,
          response.reversedEventId ?? eventId,
          "reversal",
          `${response.version}`,
        ),
      ]);
    } catch (sideEffectErr) {
      this.logger.error(
        JSON.stringify({
          event: "statdash.reversal.side_effects_failed",
          sessionId: response.sessionId,
          eventId,
          message:
            sideEffectErr instanceof Error ? sideEffectErr.message : String(sideEffectErr),
        }),
        sideEffectErr instanceof Error ? sideEffectErr.stack : undefined,
      );
    }

    return response;
  }

  private hashRequest(command: StatdashCommandDto) {
    return createHash("sha256")
      .update(
        JSON.stringify({
          sessionId: command.sessionId,
          commandType: command.commandType,
          payload: command.payload,
          expectedVersion: command.expectedVersion,
        }),
      )
      .digest("hex");
  }
}
