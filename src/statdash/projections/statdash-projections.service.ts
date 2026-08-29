import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { QueueService } from "../../common/queue/queue.service";

type ProjectionTotals = {
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  fouls: number;
  turnovers: number;
};

@Injectable()
export class StatdashProjectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
  ) {}

  async getBoxScore(sessionId: string) {
    const cached = await this.redisService.getProjectionCached(sessionId, "box_score");
    if (cached) return cached;

    const state = await this.prisma.projectionState.findUnique({
      where: {
        sessionId_projectionType: {
          sessionId,
          projectionType: "box_score",
        },
      },
    });

    if (state && state.payload) {
      await this.redisService.setProjectionCached(sessionId, "box_score", state.payload, 60);
      return state.payload;
    }

    const rebuilt = await this.rebuildAndPersist(sessionId);
    return rebuilt.boxScore;
  }

  async getShotChart(sessionId: string) {
    const cached = await this.redisService.getProjectionCached(sessionId, "shot_chart");
    if (cached) return cached;
    const events = await this.getSessionEvents(sessionId);
    const resolvedEvents = this.resolveEvents(events);
    const shotChart = resolvedEvents
      .filter((event) => event.eventType === "shot")
      .map((event) => {
        const payload = event.payload as Record<string, unknown>;
        return {
          eventId: event.id,
          teamId: payload.teamId ?? null,
          shooterPlayerId: payload.shooterPlayerId ?? null,
          result: payload.result ?? null,
          shotValue: payload.shotValue ?? null,
          x: payload.x ?? null,
          y: payload.y ?? null,
          sequence: event.sequence,
        };
      });
    await this.redisService.setProjectionCached(sessionId, "shot_chart", shotChart, 60);
    return shotChart;
  }

  async getPlayerGameProjection(sessionId: string, playerId: string) {
    const box = await this.getBoxScore(sessionId);
    return box.players[playerId] ?? this.emptyPlayerProjection(playerId);
  }

  async getMatchSummary(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }

    const box = await this.getBoxScore(sessionId);
    const summary = {
      sessionId,
      version: session.version,
      score: {
        home: session.homeScore,
        away: session.awayScore,
      },
      totals: box.totals,
      totalEvents: box.totalEvents,
      generatedAt: new Date().toISOString(),
    };
    await this.redisService.setProjectionCached(sessionId, "summary", summary, 30);
    return summary;
  }

  async rebuildAndPersist(sessionId: string) {
    const [events, sessionForTeamContext] = await Promise.all([
      this.getSessionEvents(sessionId),
      this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          match: {
            select: {
              id: true,
              homeTeamId: true,
              awayTeamId: true,
            },
          },
        },
      }),
    ]);
    if (!sessionForTeamContext) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }

    const resolvedEvents = this.resolveEvents(events);

    const replay = this.replayScoreFromEvents(resolvedEvents, events.length, {
      homeTeamId: sessionForTeamContext.match.homeTeamId,
      awayTeamId: sessionForTeamContext.match.awayTeamId,
    });
    const boxScorePayload = this.buildBoxScoreFromEvents(resolvedEvents, events.length);

    const [updatedSession, storedProjection] = await this.prisma.$transaction([
      this.prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          homeScore: replay.homeScore,
          awayScore: replay.awayScore,
          version: replay.version,
        },
      }),
      this.prisma.projectionState.upsert({
        where: {
          sessionId_projectionType: {
            sessionId,
            projectionType: "box_score",
          },
        },
        update: {
          payload: boxScorePayload,
          version: replay.version,
        },
        create: {
          sessionId,
          projectionType: "box_score",
          payload: boxScorePayload,
          version: replay.version,
        },
      }),
    ]);

    await this.syncMatchStatsFromBoxScore(
      sessionForTeamContext.match.id,
      boxScorePayload.players,
    );

    await Promise.all([
      this.redisService.setProjectionCached(sessionId, "box_score", boxScorePayload, 60),
      this.redisService.invalidateProjectionCache(sessionId, "shot_chart"),
      this.redisService.invalidateProjectionCache(sessionId, "summary"),
      this.redisService.invalidateSessionSnapshotCache(sessionId),
      this.queueService.enqueueMatchStatSync(sessionId, `${updatedSession.version}`),
    ]);

    return {
      sessionId,
      version: updatedSession.version,
      score: { home: updatedSession.homeScore, away: updatedSession.awayScore },
      projectionId: storedProjection.id,
      boxScore: boxScorePayload,
    };
  }

  resolveEvents(
    events: Array<{
      id: string;
      eventType: string;
      payload: unknown;
      sequence: number;
    }>,
  ) {
    const reversedIds = new Set<string>();
    const corrections = new Map<string, Record<string, unknown>>();

    for (const event of events) {
      if (event.eventType === "reversal") {
        const payload = event.payload as Record<string, unknown>;
        const reversedEventId = payload.reversedEventId as string | undefined;
        if (reversedEventId) reversedIds.add(reversedEventId);
      }
      if (event.eventType === "correction") {
        const payload = event.payload as Record<string, unknown>;
        const targetEventId = payload.targetEventId as string | undefined;
        const correctedPayload = payload.correctedPayload as
          | Record<string, unknown>
          | undefined;
        if (targetEventId && correctedPayload) {
          corrections.set(targetEventId, correctedPayload);
        }
      }
    }

    return events
      .filter(
        (e) =>
          !reversedIds.has(e.id) &&
          e.eventType !== "reversal" &&
          e.eventType !== "correction",
      )
      .map((e) => ({
        ...e,
        payload: corrections.has(e.id)
          ? {
              ...(e.payload as Record<string, unknown>),
              ...(corrections.get(e.id) as Record<string, unknown>),
            }
          : (e.payload as Record<string, unknown>),
      }));
  }

  replayScoreFromEvents(
    resolvedEvents: Array<{
      id: string;
      eventType: string;
      payload: unknown;
      sequence: number;
    }>,
    version: number,
    teamContext?: { homeTeamId: string; awayTeamId: string },
  ) {
    let homeScore = 0;
    let awayScore = 0;

    for (const event of resolvedEvents) {
      const payload = event.payload as Record<string, unknown>;
      if (event.eventType === "shot" && payload.result === "made") {
        const value = Number(payload.shotValue ?? 0);
        const isHome = this.isHomeTeamPayload(payload, teamContext);
        if (isHome) homeScore += value;
        else awayScore += value;
      }
      if (event.eventType === "free_throw" && payload.result === "made") {
        const isHome = this.isHomeTeamPayload(payload, teamContext);
        if (isHome) homeScore += 1;
        else awayScore += 1;
      }
    }

    return {
      homeScore,
      awayScore,
      version,
    };
  }

  private async getSessionEvents(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }

    return this.prisma.gameEvent.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
    });
  }

  private buildBoxScoreFromEvents(
    resolvedEvents: Array<{ eventType: string; payload: unknown; id: string }>,
    rawEventCount: number,
  ) {
    const players: Record<string, ProjectionTotals & { playerId: string }> = {};
    const totals: ProjectionTotals = {
      points: 0,
      rebounds: 0,
      assists: 0,
      blocks: 0,
      steals: 0,
      fouls: 0,
      turnovers: 0,
    };

    for (const event of resolvedEvents) {
      const payload = event.payload as Record<string, unknown>;
      const playerId = (payload.playerId as string | undefined) ??
        (payload.shooterPlayerId as string | undefined) ??
        (payload.foulerPlayerId as string | undefined);
      if (!playerId) continue;
      if (!players[playerId]) players[playerId] = this.emptyPlayerProjection(playerId);

      switch (event.eventType) {
        case "shot":
          if (payload.result === "made") {
            const points = Number(payload.shotValue ?? 0);
            players[playerId].points += points;
            totals.points += points;
          }
          break;
        case "free_throw":
          if (payload.result === "made") {
            players[playerId].points += 1;
            totals.points += 1;
          }
          break;
        case "rebound":
          players[playerId].rebounds += 1;
          totals.rebounds += 1;
          break;
        case "assist":
          players[playerId].assists += 1;
          totals.assists += 1;
          break;
        case "block":
          players[playerId].blocks += 1;
          totals.blocks += 1;
          break;
        case "steal":
          players[playerId].steals += 1;
          totals.steals += 1;
          break;
        case "foul":
          players[playerId].fouls += 1;
          totals.fouls += 1;
          break;
        case "turnover":
          players[playerId].turnovers += 1;
          totals.turnovers += 1;
          break;
        default:
          break;
      }
    }

    return {
      players,
      totals,
      totalEvents: rawEventCount,
    };
  }

  private emptyPlayerProjection(playerId: string) {
    return {
      playerId,
      points: 0,
      rebounds: 0,
      assists: 0,
      blocks: 0,
      steals: 0,
      fouls: 0,
      turnovers: 0,
    };
  }

  private isHomeTeamPayload(
    payload: Record<string, unknown>,
    teamContext?: { homeTeamId: string; awayTeamId: string },
  ) {
    if (payload.teamSide === "home") return true;
    if (payload.teamSide === "away") return false;
    if (teamContext && typeof payload.teamId === "string") {
      if (payload.teamId === teamContext.homeTeamId) return true;
      if (payload.teamId === teamContext.awayTeamId) return false;
    }
    return payload.teamId === "home_team";
  }

  private async syncMatchStatsFromBoxScore(
    matchId: string,
    players: Record<string, ProjectionTotals & { playerId: string }>,
  ) {
    const entries = Object.values(players);
    if (entries.length === 0) return;

    const playerIds = entries.map((entry) => entry.playerId);
    const matchPlayers = await this.prisma.matchPlayer.findMany({
      where: {
        matchId,
        playerId: { in: playerIds },
      },
      select: {
        playerId: true,
        teamId: true,
      },
    });
    const playerToTeam = new Map<string, string>();
    for (const row of matchPlayers) {
      playerToTeam.set(row.playerId, row.teamId);
    }

    for (const entry of entries) {
      const teamId = playerToTeam.get(entry.playerId);
      if (!teamId) continue;

      await this.prisma.matchStat.upsert({
        where: {
          matchId_playerId_teamId: {
            matchId,
            playerId: entry.playerId,
            teamId,
          },
        },
        update: {
          points: entry.points,
          rebounds: entry.rebounds,
          assists: entry.assists,
          blocks: entry.blocks,
          steals: entry.steals,
          fouls: entry.fouls,
          turnovers: entry.turnovers,
        },
        create: {
          matchId,
          playerId: entry.playerId,
          teamId,
          points: entry.points,
          rebounds: entry.rebounds,
          assists: entry.assists,
          blocks: entry.blocks,
          steals: entry.steals,
          fouls: entry.fouls,
          turnovers: entry.turnovers,
        },
      });
    }
  }
}
