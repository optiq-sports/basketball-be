import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GameSession, GameSessionStatus } from "@prisma/client";
import { StatdashSessionsRepository } from "./statdash-sessions.repository";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";

@Injectable()
export class StatdashSessionsService {
  constructor(
    private readonly statdashSessionsRepository: StatdashSessionsRepository,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async createSessionSeed(input: {
    matchId: string;
    homeOnLeft: boolean;
    homeAttacksLeft: boolean;
  }): Promise<GameSession> {
    return this.statdashSessionsRepository.createSession({
      ...input,
      status: GameSessionStatus.PENDING,
    });
  }

  getSessionById(sessionId: string): Promise<GameSession | null> {
    return this.statdashSessionsRepository.findSessionById(sessionId);
  }

  async resolveMatchKey(matchKey: string) {
    const normalizedMatchKey = matchKey.trim();
    if (!normalizedMatchKey) {
      throw new BadRequestException({
        code: "SD_SESSION_INVALID_MATCH_KEY",
        message: "matchKey is required",
      });
    }

    // Prefer explicit match id keying to avoid ambiguous tournament-level lookups.
    let match = await this.prisma.match.findUnique({
      where: { id: normalizedMatchKey },
      include: {
        gameSessions: true,
      },
    });

    if (!match) {
      const matchesByTournamentCode = await this.prisma.match.findMany({
        where: {
          tournament: { code: normalizedMatchKey },
        },
        include: {
          gameSessions: true,
        },
        orderBy: [{ status: "desc" }, { scheduledDate: "desc" }],
      });
      if (matchesByTournamentCode.length > 1) {
        throw new BadRequestException({
          code: "SD_SESSION_MATCH_KEY_AMBIGUOUS",
          message:
            "matchKey maps to multiple matches. Use explicit matchId as matchKey.",
        });
      }
      match = matchesByTournamentCode[0] ?? null;
    }

    if (!match) {
      throw new NotFoundException({
        code: "SD_SESSION_MATCH_NOT_FOUND",
        message: "No match found for supplied matchKey",
      });
    }

    const activeSession = match.gameSessions ?? null;
    return {
      matchId: match.id,
      matchStatus: match.status,
      sessionId: activeSession?.id ?? null,
      sessionStatus: activeSession?.status ?? null,
    };
  }

  async bootstrap(input: { matchId?: string; sessionId?: string }) {
    if (!input.matchId && !input.sessionId) {
      throw new BadRequestException({
        code: "SD_SESSION_BOOTSTRAP_INPUT_INVALID",
        message: "Provide either matchId or sessionId",
      });
    }

    if (input.sessionId) {
      const cachedSnapshot = await this.redisService.getSessionSnapshotCached(
        input.sessionId,
      );
      if (cachedSnapshot) {
        return cachedSnapshot;
      }
    }

    let session = input.sessionId
      ? await this.prisma.gameSession.findUnique({
          where: { id: input.sessionId },
          include: { match: true },
        })
      : null;

    if (!session && input.matchId) {
      const match = await this.prisma.match.findUnique({
        where: { id: input.matchId },
      });
      if (!match) {
        throw new NotFoundException({
          code: "SD_SESSION_MATCH_NOT_FOUND",
          message: "Match does not exist",
        });
      }

      session = await this.prisma.gameSession.upsert({
        where: { matchId: input.matchId },
        update: {},
        create: {
          matchId: input.matchId,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        },
        include: { match: true },
      });
    }

    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }

    const cachedRecentEvents = await this.redisService.getRecentEventsCached(
      session.id,
    );
    const [recentEvents, latestLineup] = await Promise.all([
      cachedRecentEvents
        ? Promise.resolve(
            cachedRecentEvents as Array<{
              id: string;
              sequence: number;
              eventType: string;
              payload: unknown;
              createdAt: Date;
              period: number | null;
              clockSecondsRemaining: number | null;
            }>,
          )
        : this.prisma.gameEvent.findMany({
            where: { sessionId: session.id },
            orderBy: { sequence: "desc" },
            take: 25,
          }),
      this.prisma.lineupState.findFirst({
        where: { sessionId: session.id },
        orderBy: { capturedAt: "desc" },
      }),
    ]);

    const orderedEvents = cachedRecentEvents
      ? (recentEvents as Array<{
          id: string;
          sequence: number;
          eventType: string;
          payload: unknown;
          createdAt: Date;
          period: number | null;
          clockSecondsRemaining: number | null;
        }>)
      : recentEvents.reverse();

    const snapshot = this.buildSnapshot(session, orderedEvents, latestLineup);
    await this.redisService.setSessionSnapshotCached(session.id, snapshot, 30);
    if (!cachedRecentEvents) {
      await this.redisService.setRecentEventsCached(
        session.id,
        orderedEvents,
        30,
      );
    }

    return snapshot;
  }

  async startSession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }
    if (
      session.status === GameSessionStatus.COMPLETED ||
      session.status === GameSessionStatus.CANCELLED
    ) {
      throw new ConflictException({
        code: "SD_SESSION_START_NOT_ALLOWED",
        message: "Session cannot be started from current status",
      });
    }

    const [updatedSession] = await this.prisma.$transaction([
      this.prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: GameSessionStatus.IN_PROGRESS,
          startedAt: session.startedAt ?? new Date(),
        },
      }),
      this.prisma.match.update({
        where: { id: session.matchId },
        data: {
          status: "LIVE",
        },
      }),
    ]);
    return updatedSession;
  }

  async pauseSession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }
    if (session.status !== GameSessionStatus.IN_PROGRESS) {
      throw new ConflictException({
        code: "SD_SESSION_PAUSE_NOT_ALLOWED",
        message: "Only in-progress sessions can be paused",
      });
    }

    return this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: GameSessionStatus.PAUSED,
      },
    });
  }

  async completeSession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }
    if (
      session.status === GameSessionStatus.COMPLETED ||
      session.status === GameSessionStatus.CANCELLED
    ) {
      throw new ConflictException({
        code: "SD_SESSION_COMPLETE_NOT_ALLOWED",
        message: "Session is already completed or cancelled",
      });
    }

    // Wrap in transaction to ensure consistency with Match status
    const [updatedSession] = await this.prisma.$transaction([
      this.prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: GameSessionStatus.COMPLETED,
          endedAt: session.endedAt ?? new Date(),
        },
      }),
      this.prisma.match.update({
        where: { id: session.matchId },
        data: {
          status: "COMPLETED", // Note: MatchStatus.COMPLETED
        },
      }),
    ]);
    return updatedSession;
  }

  async cancelSession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }
    if (
      session.status === GameSessionStatus.COMPLETED ||
      session.status === GameSessionStatus.CANCELLED
    ) {
      throw new ConflictException({
        code: "SD_SESSION_CANCEL_NOT_ALLOWED",
        message: "Session is already completed or cancelled",
      });
    }

    const [updatedSession] = await this.prisma.$transaction([
      this.prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          status: GameSessionStatus.CANCELLED,
          endedAt: session.endedAt ?? new Date(),
        },
      }),
      this.prisma.match.update({
        where: { id: session.matchId },
        data: {
          status: "CANCELLED", // Note: MatchStatus.CANCELLED
        },
      }),
    ]);
    return updatedSession;
  }

  async getState(sessionId: string) {
    return this.bootstrap({ sessionId });
  }

  private buildSnapshot(
    session: GameSession & {
      match?: { homeTeamId: string; awayTeamId: string };
    },
    recentEvents: Array<{
      id: string;
      sequence: number;
      eventType: string;
      payload: unknown;
      createdAt: Date;
      period: number | null;
      clockSecondsRemaining: number | null;
    }>,
    latestLineup: { homeLineup: unknown; awayLineup: unknown } | null,
  ) {
    return {
      sessionId: session.id,
      matchId: session.matchId,
      status: session.status,
      quarter: session.quarter,
      clockSecondsRemaining: session.clockSecondsRemaining,
      score: {
        home: session.homeScore,
        away: session.awayScore,
      },
      orientation: {
        homeOnLeft: session.homeOnLeft,
        homeAttacksLeft: session.homeAttacksLeft,
      },
      jumpBallWinnerTeamId: session.jumpBallWinnerTeamId,
      possessionTeamId: session.possessionTeamId,
      activeLineups: latestLineup ?? { homeLineup: null, awayLineup: null },
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        sequence: event.sequence,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt,
        period: event.period,
        clockSecondsRemaining: event.clockSecondsRemaining,
      })),
      version: session.version,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }
}
