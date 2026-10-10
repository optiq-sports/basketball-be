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
  fga: number;
  fgm: number;
  fg3a: number;
  fg3m: number;
  twoPa: number;
  twoPm: number;
  threePa: number;
  threePm: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
  plusMinus: number;
  eff: number;
  secondsPlayed: number;
};

@Injectable()
export class StatdashProjectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
  ) {}

  private async checkSessionAccess(sessionId: string, user?: any) {
    if (!user || user?.role === "SUPER_ADMIN") return;

    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { match: { select: { clientId: true } } },
    });

    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }

    if (
      user?.role === "CLIENT" ||
      user?.role === "ADMIN" ||
      user?.role === "STATISTICIAN"
    ) {
      if (
        session.match.clientId &&
        (!user.clientIds || !user.clientIds.includes(session.match.clientId))
      ) {
        throw new NotFoundException({
          code: "SD_SESSION_NOT_FOUND",
          message: "Session does not exist",
        });
      }
    }
  }

  async getBoxScore(sessionId: string, user?: any) {
    await this.checkSessionAccess(sessionId, user);
    const cached = await this.redisService.getProjectionCached(
      sessionId,
      "box_score",
    );
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
      await this.redisService.setProjectionCached(
        sessionId,
        "box_score",
        state.payload,
        60,
      );
      return state.payload;
    }

    const rebuilt = await this.rebuildAndPersist(sessionId, user);
    return rebuilt.boxScore;
  }

  async getShotChart(sessionId: string, user?: any) {
    await this.checkSessionAccess(sessionId, user);
    const cached = await this.redisService.getProjectionCached(
      sessionId,
      "shot_chart",
    );
    if (cached) return cached;
    const events = await this.getSessionEvents(sessionId);
    const resolvedEvents = this.resolveEvents(events);
    const shotChart = resolvedEvents
      .filter((event) => event.eventType === "shot")
      .map((event) => {
        const payload = event.payload as Record<string, unknown>;
        const shot = payload.shot as Record<string, unknown> | undefined;
        return {
          eventId: event.id,
          teamId: payload.teamId ?? null,
          shooterPlayerId: payload.shooterPlayerId ?? null,
          result: shot?.result ?? null,
          shotValue: shot?.value ?? null,
          x: shot?.x ?? null,
          y: shot?.y ?? null,
          sequence: event.sequence,
          period: event.period ?? null,
        };
      });
    await this.redisService.setProjectionCached(
      sessionId,
      "shot_chart",
      shotChart,
      60,
    );
    return shotChart;
  }

  async getPlayerGameProjection(
    sessionId: string,
    playerId: string,
    user?: any,
  ) {
    // getBoxScore already checks session access, but we do it anyway if needed or let getBoxScore handle it.
    // We must pass user to getBoxScore.
    const box = await this.getBoxScore(sessionId, user);
    return box.players[playerId] ?? this.emptyPlayerProjection(playerId);
  }

  async getMatchSummary(sessionId: string, user?: any) {
    await this.checkSessionAccess(sessionId, user);
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    // checkSessionAccess already throws if session is not found, so no need to check again.

    const box = await this.getBoxScore(sessionId, user);
    const summary = {
      sessionId,
      version: session.version,
      score: {
        home: session.homeScore,
        away: session.awayScore,
      },
      totals: box.totals,
      advanced: {
        possessions: box.totals.fga + 0.44 * box.totals.fta - box.totals.oreb + box.totals.turnovers,
        trueShooting: (box.totals.fga + 0.44 * box.totals.fta) > 0 ? (box.totals.points / (2 * (box.totals.fga + 0.44 * box.totals.fta))) : 0,
        offensiveRating: 0,
        defensiveRating: 0
      },
      totalEvents: box.totalEvents,
      generatedAt: new Date().toISOString(),
    };
    await this.redisService.setProjectionCached(
      sessionId,
      "summary",
      summary,
      30,
    );
    return summary;
  }

  async getTimeline(sessionId: string, user?: any) {
    await this.checkSessionAccess(sessionId, user);
    const cached = await this.redisService.getProjectionCached(
      sessionId,
      "timeline"
    );
    if (cached) return cached;

    const events = await this.getSessionEvents(sessionId);
    const resolvedEvents = this.resolveEvents(events);
    
    // Select relevant fields to return for the timeline
    const timeline = resolvedEvents.map(event => ({
      id: event.id,
      sequence: event.sequence,
      eventType: event.eventType,
      period: event.period,
      clockSecondsRemaining: (event as any).clockSecondsRemaining,
      payload: event.payload
    }));

    await this.redisService.setProjectionCached(
      sessionId,
      "timeline",
      timeline,
      60
    );

    return timeline;
  }

  async rebuildAndPersist(sessionId: string, user?: any) {
    await this.checkSessionAccess(sessionId, user);
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
    const boxScorePayload = this.buildBoxScoreFromEvents(
      resolvedEvents,
      events.length,
    );

    const [updatedSession, storedProjection] = await this.prisma.$transaction([
      this.prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          homeScore: replay.homeScore,
          awayScore: replay.awayScore,
          quarter: replay.quarter,
          clockSecondsRemaining: replay.clockSecondsRemaining,
          possessionTeamId: replay.possessionTeamId,
          jumpBallWinnerTeamId: replay.jumpBallWinnerTeamId,
          version: replay.version,
        },
      }),
      this.prisma.match.update({
        where: { id: sessionForTeamContext.match.id },
        data: {
          homeScore: replay.homeScore,
          awayScore: replay.awayScore,
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
      this.redisService.setProjectionCached(
        sessionId,
        "box_score",
        boxScorePayload,
        60,
      ),
      this.redisService.invalidateProjectionCache(sessionId, "shot_chart"),
      this.redisService.invalidateProjectionCache(sessionId, "timeline"),
      this.redisService.invalidateProjectionCache(sessionId, "summary"),
      this.redisService.invalidateSessionSnapshotCache(sessionId),
      this.queueService.enqueueMatchStatSync(
        sessionId,
        `${updatedSession.version}`,
      ),
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
      period?: number | null;
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
    let quarter = 1;
    let clockSecondsRemaining = 600;
    let possessionTeamId: string | null = null;
    let jumpBallWinnerTeamId: string | null = null;
    let homeLineup: string[] = [];
    let awayLineup: string[] = [];

    for (const event of resolvedEvents) {
      const payload = event.payload as Record<string, unknown>;
      if (event.eventType === "shot") {
        const shot = payload.shot as Record<string, unknown> | undefined;
        if (shot?.result === "made") {
          const value = Number(shot.value ?? 0);
          const isHome = this.isHomeTeamPayload(payload, teamContext);
          if (isHome) homeScore += value;
          else awayScore += value;
        }
      }
      if (event.eventType === "free_throw" && payload.result === "made") {
        const isHome = this.isHomeTeamPayload(payload, teamContext);
        if (isHome) homeScore += 1;
        else awayScore += 1;
      }

      if (typeof payload.period === "number") {
        quarter = payload.period;
      }
      if (typeof payload.clockSecondsRemaining === "number") {
        clockSecondsRemaining = payload.clockSecondsRemaining;
      }
      if (
        typeof payload.possessionTeamId === "string" ||
        payload.possessionTeamId === null
      ) {
        possessionTeamId = payload.possessionTeamId as string | null;
      }
      if (typeof payload.jumpBallWinnerTeamId === "string") {
        jumpBallWinnerTeamId = payload.jumpBallWinnerTeamId;
      }

      if (event.eventType === "substitution") {
        if (payload.homeLineup && Array.isArray(payload.homeLineup)) {
          homeLineup = payload.homeLineup as string[];
        }
        if (payload.awayLineup && Array.isArray(payload.awayLineup)) {
          awayLineup = payload.awayLineup as string[];
        }

        if (payload.playerOutId && payload.playerInId && payload.teamId) {
          const targetLineup =
            payload.teamId === teamContext?.homeTeamId
              ? homeLineup
              : payload.teamId === teamContext?.awayTeamId
                ? awayLineup
                : null;
          if (targetLineup) {
            const index = targetLineup.indexOf(payload.playerOutId as string);
            if (index !== -1) {
              targetLineup[index] = payload.playerInId as string;
            } else {
              targetLineup.push(payload.playerInId as string);
            }
          }
        }
      }
    }

    return {
      homeScore,
      awayScore,
      quarter,
      clockSecondsRemaining,
      possessionTeamId,
      jumpBallWinnerTeamId,
      version,
      homeLineup,
      awayLineup,
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
      fga: 0,
      fgm: 0,
      fg3a: 0,
      fg3m: 0,
      twoPa: 0,
      twoPm: 0,
      threePa: 0,
      threePm: 0,
      fta: 0,
      ftm: 0,
      oreb: 0,
      dreb: 0,
      plusMinus: 0,
      eff: 0,
      secondsPlayed: 0,
    };

    for (const event of resolvedEvents) {
      const payload = event.payload as Record<string, unknown>;
      const playerId =
        (payload.playerId as string | undefined) ??
        (payload.shooterPlayerId as string | undefined) ??
        (payload.foulerPlayerId as string | undefined) ??
        (payload.reboundPlayerId as string | undefined) ??
        (payload.turnoverPlayerId as string | undefined);
      if (!playerId) continue;
      if (!players[playerId])
        players[playerId] = this.emptyPlayerProjection(playerId);

      switch (event.eventType) {
        case "shot": {
          const shot = payload.shot as Record<string, unknown> | undefined;

          if (shot) {
            const points = Number(shot.value ?? 0);

            players[playerId].fga += 1;
            totals.fga += 1;

            if (points === 3) {
              players[playerId].fg3a += 1;
              totals.fg3a += 1;
              players[playerId].threePa += 1;
              totals.threePa += 1;
            } else if (points === 2) {
              players[playerId].twoPa += 1;
              totals.twoPa += 1;
            }

            if (shot.result === "made") {
              players[playerId].points += points;
              totals.points += points;
              players[playerId].fgm += 1;
              totals.fgm += 1;

              if (points === 3) {
                players[playerId].fg3m += 1;
                totals.fg3m += 1;
                players[playerId].threePm += 1;
                totals.threePm += 1;
              } else if (points === 2) {
                players[playerId].twoPm += 1;
                totals.twoPm += 1;
              }
            }
          }

          if (payload.assistPlayerId) {
            const aId = payload.assistPlayerId as string;
            if (!players[aId]) players[aId] = this.emptyPlayerProjection(aId);
            players[aId].assists += 1;
            totals.assists += 1;
          }
          if (payload.blockPlayerId) {
            const bId = payload.blockPlayerId as string;
            if (!players[bId]) players[bId] = this.emptyPlayerProjection(bId);
            players[bId].blocks += 1;
            totals.blocks += 1;
          }
          break;
        }
        case "free_throw":
          players[playerId].fta += 1;
          totals.fta += 1;
          if (payload.result === "made") {
            players[playerId].points += 1;
            totals.points += 1;
            players[playerId].ftm += 1;
            totals.ftm += 1;
          }
          break;
        case "rebound":
          players[playerId].rebounds += 1;
          totals.rebounds += 1;
          if (payload.type === "offensive") {
            players[playerId].oreb += 1;
            totals.oreb += 1;
          } else {
            players[playerId].dreb += 1;
            totals.dreb += 1;
          }
          break;
        case "foul":
          players[playerId].fouls += 1;
          totals.fouls += 1;
          break;
        case "turnover": {
          players[playerId].turnovers += 1;
          totals.turnovers += 1;

          if (payload.stealPlayerId) {
            const sId = payload.stealPlayerId as string;
            if (!players[sId]) players[sId] = this.emptyPlayerProjection(sId);
            players[sId].steals += 1;
            totals.steals += 1;
          }
          break;
        }
        default:
          break;
      }
    }

    for (const p of Object.values(players)) {
      p.eff = (p.points + p.rebounds + p.assists + p.steals + p.blocks) - (p.fga - p.fgm) - (p.fta - p.ftm) - p.turnovers;
      totals.eff += p.eff;
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
      fga: 0,
      fgm: 0,
      fg3a: 0,
      fg3m: 0,
      twoPa: 0,
      twoPm: 0,
      threePa: 0,
      threePm: 0,
      fta: 0,
      ftm: 0,
      oreb: 0,
      dreb: 0,
      plusMinus: 0,
      eff: 0,
      secondsPlayed: 0,
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
          fga: entry.fga,
          fgm: entry.fgm,
          fg3a: entry.fg3a,
          fg3m: entry.fg3m,
          twoPa: entry.twoPa,
          twoPm: entry.twoPm,
          threePa: entry.threePa,
          threePm: entry.threePm,
          fta: entry.fta,
          ftm: entry.ftm,
          oreb: entry.oreb,
          dreb: entry.dreb,
          plusMinus: entry.plusMinus,
          eff: entry.eff,
          secondsPlayed: entry.secondsPlayed,
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
          fga: entry.fga,
          fgm: entry.fgm,
          fg3a: entry.fg3a,
          fg3m: entry.fg3m,
          twoPa: entry.twoPa,
          twoPm: entry.twoPm,
          threePa: entry.threePa,
          threePm: entry.threePm,
          fta: entry.fta,
          ftm: entry.ftm,
          oreb: entry.oreb,
          dreb: entry.dreb,
          plusMinus: entry.plusMinus,
          eff: entry.eff,
          secondsPlayed: entry.secondsPlayed,
        },
      });
    }
  }
}
