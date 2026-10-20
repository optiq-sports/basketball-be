import { Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { QueueService } from "../../common/queue/queue.service";
import { AuthenticatedUser } from "../../common/interfaces/user.interface";

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

  private async checkSessionAccess(
    sessionId: string,
    user?: AuthenticatedUser,
  ) {
    if (!user || user?.role === Role.SUPER_ADMIN) return;

    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        match: {
          select: {
            clientId: true,
            broadcasters: { select: { userId: true } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException({
        code: "SD_SESSION_NOT_FOUND",
        message: "Session does not exist",
      });
    }

    if (user?.role === Role.BROADCASTER) {
      const isAssigned = session.match?.broadcasters?.some(
        (b) => b.userId === user.id,
      );
      if (!isAssigned) {
        throw new NotFoundException({
          code: "SD_SESSION_NOT_FOUND",
          message: "Session does not exist",
        });
      }
      return;
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
        possessions:
          box.totals.fga +
          0.44 * box.totals.fta -
          box.totals.oreb +
          box.totals.turnovers,
        trueShooting:
          box.totals.fga + 0.44 * box.totals.fta > 0
            ? box.totals.points / (2 * (box.totals.fga + 0.44 * box.totals.fta))
            : 0,
        offensiveRating: 0,
        defensiveRating: 0,
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

  async getTimeline(sessionId: string, user?: AuthenticatedUser) {
    await this.checkSessionAccess(sessionId, user);
    const cached = await this.redisService.getProjectionCached(
      sessionId,
      "timeline",
    );
    if (cached) return cached;

    const [events, session] = await Promise.all([
      this.getSessionEvents(sessionId),
      this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          match: {
            select: {
              id: true,
              homeTeamId: true,
              awayTeamId: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const resolvedEvents = this.resolveEvents(events);
    const teamContext = session?.match
      ? {
          homeTeamId: session.match.homeTeamId,
          awayTeamId: session.match.awayTeamId,
        }
      : undefined;

    let homeScore = 0;
    let awayScore = 0;
    let currentPeriod = 1;
    const timeline: Array<Record<string, unknown>> = [];

    for (const event of resolvedEvents) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const eventPeriod =
        typeof (event as { period?: number | null }).period === "number" &&
        (event as { period?: number | null }).period! > 0
          ? (event as { period?: number | null }).period!
          : typeof payload.period === "number" && (payload.period as number) > 0
            ? (payload.period as number)
            : currentPeriod;

      if (eventPeriod > currentPeriod) {
        for (let p = currentPeriod; p < eventPeriod; p++) {
          timeline.push({
            id: `period_end_${p}`,
            sequence: timeline.length + 1,
            eventType: "period_end",
            period: p,
            clockSecondsRemaining: 0,
            teamId: null,
            playerId: null,
            description: "END OF PERIOD",
            homeScore,
            awayScore,
            payload: { period: p },
          });
        }
        currentPeriod = eventPeriod;
      }

      if (event.eventType === "shot") {
        const shot = payload.shot as Record<string, unknown> | undefined;
        if (shot?.result === "made") {
          const value = Number(shot.value ?? 0);
          const isHome = this.isHomeTeamPayload(payload, teamContext);
          if (isHome) homeScore += value;
          else awayScore += value;
        }
      } else if (
        event.eventType === "free_throw" &&
        payload.result === "made"
      ) {
        const isHome = this.isHomeTeamPayload(payload, teamContext);
        if (isHome) homeScore += 1;
        else awayScore += 1;
      }

      const { teamId, playerId } = this.extractTimelineTeamAndPlayer(payload);
      const rawEvent = event as Record<string, unknown>;
      const clockSecondsRemaining =
        typeof rawEvent.clockSecondsRemaining === "number"
          ? (rawEvent.clockSecondsRemaining as number)
          : typeof payload.clockSecondsRemaining === "number"
            ? (payload.clockSecondsRemaining as number)
            : 0;

      timeline.push({
        id: event.id,
        sequence: event.sequence,
        eventType: event.eventType,
        period: eventPeriod,
        clockSecondsRemaining,
        teamId,
        playerId,
        description: this.buildTimelineDescription(event.eventType, payload),
        homeScore,
        awayScore,
        payload: event.payload,
      });
    }

    const isGameFinished =
      session?.status === "COMPLETED" ||
      (session?.status as unknown as string) === "FINISHED" ||
      session?.match?.status === "COMPLETED";

    if (isGameFinished || currentPeriod >= 4) {
      const hasFinalPeriodEnd = timeline.some(
        (row) => row.eventType === "period_end" && row.period === currentPeriod,
      );
      if (!hasFinalPeriodEnd && timeline.length > 0) {
        timeline.push({
          id: `period_end_${currentPeriod}`,
          sequence: timeline.length + 1,
          eventType: "period_end",
          period: currentPeriod,
          clockSecondsRemaining: 0,
          teamId: null,
          playerId: null,
          description: "END OF PERIOD",
          homeScore,
          awayScore,
          payload: { period: currentPeriod },
        });
      }

      if (isGameFinished) {
        timeline.push({
          id: `game_end_${sessionId}`,
          sequence: timeline.length + 1,
          eventType: "game_end",
          period: currentPeriod,
          clockSecondsRemaining: 0,
          teamId: null,
          playerId: null,
          description: "END OF GAME",
          homeScore,
          awayScore,
          payload: { finalScore: { home: homeScore, away: awayScore } },
        });
      }
    }

    await this.redisService.setProjectionCached(
      sessionId,
      "timeline",
      timeline,
      60,
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
              homeTeam: {
                select: {
                  playerTeams: {
                    select: {
                      jerseyNumber: true,
                      player: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          photo: true,
                        },
                      },
                    },
                  },
                },
              },
              awayTeam: {
                select: {
                  playerTeams: {
                    select: {
                      jerseyNumber: true,
                      player: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          photo: true,
                        },
                      },
                    },
                  },
                },
              },
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
      {
        homeTeamId: sessionForTeamContext.match.homeTeamId,
        awayTeamId: sessionForTeamContext.match.awayTeamId,
      },
    );

    const playerMetadata = new Map<
      string,
      {
        teamId: string;
        name: string;
        jerseyNumber: number | null;
        photo: string | null;
      }
    >();
    for (const pt of sessionForTeamContext.match?.homeTeam?.playerTeams || []) {
      if (pt.player) {
        playerMetadata.set(pt.player.id, {
          teamId: sessionForTeamContext.match.homeTeamId,
          name: `${pt.player.firstName} ${pt.player.lastName}`.trim(),
          jerseyNumber: pt.jerseyNumber,
          photo: pt.player.photo ?? null,
        });
      }
    }
    for (const pt of sessionForTeamContext.match?.awayTeam?.playerTeams || []) {
      if (pt.player) {
        playerMetadata.set(pt.player.id, {
          teamId: sessionForTeamContext.match.awayTeamId,
          name: `${pt.player.firstName} ${pt.player.lastName}`.trim(),
          jerseyNumber: pt.jerseyNumber,
          photo: pt.player.photo ?? null,
        });
      }
    }
    for (const [pId, meta] of playerMetadata.entries()) {
      if (boxScorePayload.players[pId]) {
        boxScorePayload.players[pId].teamId =
          boxScorePayload.players[pId].teamId || meta.teamId;
        boxScorePayload.players[pId].name = meta.name;
        boxScorePayload.players[pId].jerseyNumber = meta.jerseyNumber;
        boxScorePayload.players[pId].photo = meta.photo;
      }
    }

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
          quarter1Home: replay.quarter1Home,
          quarter1Away: replay.quarter1Away,
          quarter2Home: replay.quarter2Home,
          quarter2Away: replay.quarter2Away,
          quarter3Home: replay.quarter3Home,
          quarter3Away: replay.quarter3Away,
          quarter4Home: replay.quarter4Home,
          quarter4Away: replay.quarter4Away,
          overtimeHome: replay.overtimeHome > 0 ? replay.overtimeHome : null,
          overtimeAway: replay.overtimeAway > 0 ? replay.overtimeAway : null,
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
          Record<string, unknown> | undefined;
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
      period?: number | null;
      clockSecondsRemaining?: number | null;
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
    let quarter1Home = 0;
    let quarter1Away = 0;
    let quarter2Home = 0;
    let quarter2Away = 0;
    let quarter3Home = 0;
    let quarter3Away = 0;
    let quarter4Home = 0;
    let quarter4Away = 0;
    let overtimeHome = 0;
    let overtimeAway = 0;

    for (const event of resolvedEvents) {
      const payload = event.payload as Record<string, unknown>;
      const eventPeriod =
        typeof (event as { period?: number | null }).period === "number" &&
        (event as { period?: number | null }).period! > 0
          ? (event as { period?: number | null }).period!
          : typeof payload.period === "number" && payload.period > 0
            ? payload.period
            : quarter;

      if (event.eventType === "shot") {
        const shot = payload.shot as Record<string, unknown> | undefined;
        if (shot?.result === "made") {
          const value = Number(shot.value ?? 0);
          const isHome = this.isHomeTeamPayload(payload, teamContext);
          if (isHome) {
            homeScore += value;
            if (eventPeriod === 1) quarter1Home += value;
            else if (eventPeriod === 2) quarter2Home += value;
            else if (eventPeriod === 3) quarter3Home += value;
            else if (eventPeriod === 4) quarter4Home += value;
            else if (eventPeriod > 4) overtimeHome += value;
          } else {
            awayScore += value;
            if (eventPeriod === 1) quarter1Away += value;
            else if (eventPeriod === 2) quarter2Away += value;
            else if (eventPeriod === 3) quarter3Away += value;
            else if (eventPeriod === 4) quarter4Away += value;
            else if (eventPeriod > 4) overtimeAway += value;
          }
        }
      }
      if (event.eventType === "free_throw" && payload.result === "made") {
        const isHome = this.isHomeTeamPayload(payload, teamContext);
        if (isHome) {
          homeScore += 1;
          if (eventPeriod === 1) quarter1Home += 1;
          else if (eventPeriod === 2) quarter2Home += 1;
          else if (eventPeriod === 3) quarter3Home += 1;
          else if (eventPeriod === 4) quarter4Home += 1;
          else if (eventPeriod > 4) overtimeHome += 1;
        } else {
          awayScore += 1;
          if (eventPeriod === 1) quarter1Away += 1;
          else if (eventPeriod === 2) quarter2Away += 1;
          else if (eventPeriod === 3) quarter3Away += 1;
          else if (eventPeriod === 4) quarter4Away += 1;
          else if (eventPeriod > 4) overtimeAway += 1;
        }
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
      quarter1Home,
      quarter1Away,
      quarter2Home,
      quarter2Away,
      quarter3Home,
      quarter3Away,
      quarter4Home,
      quarter4Away,
      overtimeHome,
      overtimeAway,
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

  buildBoxScoreFromEvents(
    resolvedEvents: Array<{ eventType: string; payload: unknown; id: string }>,
    rawEventCount: number,
    teamContext?: { homeTeamId: string; awayTeamId: string },
  ) {
    const players: Record<
      string,
      ProjectionTotals & {
        playerId: string;
        teamId?: string | null;
        name?: string | null;
        jerseyNumber?: number | null;
        photo?: string | null;
      }
    > = {};
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

    const ensurePlayer = (pId: string, tId?: string | null) => {
      if (!players[pId]) {
        players[pId] = this.emptyPlayerProjection(pId, tId ?? null);
      } else if (tId && !players[pId].teamId) {
        players[pId].teamId = tId;
      }
      return players[pId];
    };

    let homeLineup: string[] = [];
    let awayLineup: string[] = [];
    let currentPeriod = 1;
    let currentClock = 600;
    let clockObserved = false;

    const addElapsedTimeToLineups = (elapsed: number) => {
      if (elapsed <= 0) return;
      for (const pId of homeLineup) {
        ensurePlayer(pId, teamContext?.homeTeamId);
        players[pId].secondsPlayed += elapsed;
      }
      for (const pId of awayLineup) {
        ensurePlayer(pId, teamContext?.awayTeamId);
        players[pId].secondsPlayed += elapsed;
      }
    };

    for (const event of resolvedEvents) {
      const payload = event.payload as Record<string, unknown>;

      const eventPeriod =
        typeof (event as { period?: number | null }).period === "number" &&
        (event as { period?: number | null }).period! > 0
          ? (event as { period?: number | null }).period!
          : typeof payload.period === "number" && payload.period > 0
            ? payload.period
            : currentPeriod;

      const eventClock =
        typeof payload.clockSecondsRemaining === "number"
          ? payload.clockSecondsRemaining
          : typeof (event as { clockSecondsRemaining?: number | null })
                .clockSecondsRemaining === "number"
            ? (event as { clockSecondsRemaining?: number | null })
                .clockSecondsRemaining!
            : null;

      if (eventPeriod > currentPeriod) {
        if (clockObserved && currentClock > 0) {
          addElapsedTimeToLineups(currentClock);
        }
        currentPeriod = eventPeriod;
        currentClock = 600;
        if (eventClock !== null) {
          const elapsedNew = Math.max(0, currentClock - eventClock);
          addElapsedTimeToLineups(elapsedNew);
          currentClock = eventClock;
          clockObserved = true;
        }
      } else if (eventClock !== null) {
        if (!clockObserved) {
          const elapsed = Math.max(0, currentClock - eventClock);
          addElapsedTimeToLineups(elapsed);
          currentClock = eventClock;
          clockObserved = true;
        } else if (eventClock < currentClock) {
          const elapsed = currentClock - eventClock;
          addElapsedTimeToLineups(elapsed);
          currentClock = eventClock;
        } else if (eventClock > currentClock) {
          currentClock = eventClock;
        }
      }

      if (event.eventType === "substitution") {
        if (payload.homeLineup && Array.isArray(payload.homeLineup)) {
          homeLineup = [...(payload.homeLineup as string[])];
          for (const pId of homeLineup) {
            ensurePlayer(pId, teamContext?.homeTeamId);
          }
        }
        if (payload.awayLineup && Array.isArray(payload.awayLineup)) {
          awayLineup = [...(payload.awayLineup as string[])];
          for (const pId of awayLineup) {
            ensurePlayer(pId, teamContext?.awayTeamId);
          }
        }

        if (payload.playerOutId && payload.playerInId && payload.teamId) {
          const inId = payload.playerInId as string;
          const outId = payload.playerOutId as string;
          const tId = payload.teamId as string;
          ensurePlayer(inId, tId);
          ensurePlayer(outId, tId);

          const targetLineup =
            payload.teamId === teamContext?.homeTeamId
              ? homeLineup
              : payload.teamId === teamContext?.awayTeamId
                ? awayLineup
                : null;
          if (targetLineup) {
            const index = targetLineup.indexOf(outId);
            if (index !== -1) {
              targetLineup[index] = inId;
            } else {
              targetLineup.push(inId);
            }
          }
        }
        continue;
      }

      const playerId =
        (payload.playerId as string | undefined) ??
        (payload.shooterPlayerId as string | undefined) ??
        (payload.foulerPlayerId as string | undefined) ??
        (payload.reboundPlayerId as string | undefined) ??
        (payload.turnoverPlayerId as string | undefined) ??
        (payload.assistPlayerId as string | undefined);

      const eventTeamId = (payload.teamId as string | undefined) ?? null;

      if (!playerId && event.eventType !== "assist") continue;

      if (playerId) {
        ensurePlayer(playerId, eventTeamId);
      }

      if (teamContext && playerId) {
        const isHome = this.isHomeTeamPayload(payload, teamContext);
        if (isHome) {
          if (!homeLineup.includes(playerId) && homeLineup.length < 5) {
            homeLineup.push(playerId);
          }
        } else {
          if (!awayLineup.includes(playerId) && awayLineup.length < 5) {
            awayLineup.push(playerId);
          }
        }
      }

      const updatePlusMinus = (points: number, isHomeScore: boolean) => {
        if (points === 0) return;
        if (isHomeScore) {
          for (const pId of homeLineup) {
            ensurePlayer(pId, teamContext?.homeTeamId);
            players[pId].plusMinus += points;
          }
          for (const pId of awayLineup) {
            ensurePlayer(pId, teamContext?.awayTeamId);
            players[pId].plusMinus -= points;
          }
        } else {
          for (const pId of awayLineup) {
            ensurePlayer(pId, teamContext?.awayTeamId);
            players[pId].plusMinus += points;
          }
          for (const pId of homeLineup) {
            ensurePlayer(pId, teamContext?.homeTeamId);
            players[pId].plusMinus -= points;
          }
        }
      };

      switch (event.eventType) {
        case "shot": {
          const shot = payload.shot as Record<string, unknown> | undefined;

          if (shot && playerId) {
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

              const isHome = this.isHomeTeamPayload(payload, teamContext);
              updatePlusMinus(points, isHome);
            }
          }

          if (payload.assistPlayerId) {
            const aId = payload.assistPlayerId as string;
            ensurePlayer(aId, eventTeamId);
            players[aId].assists += 1;
            totals.assists += 1;
          }
          if (payload.blockPlayerId) {
            const bId = payload.blockPlayerId as string;
            const blockTeamId =
              teamContext && eventTeamId
                ? eventTeamId === teamContext.homeTeamId
                  ? teamContext.awayTeamId
                  : teamContext.homeTeamId
                : null;
            ensurePlayer(bId, blockTeamId);
            players[bId].blocks += 1;
            totals.blocks += 1;
          }
          break;
        }
        case "free_throw": {
          if (playerId) {
            players[playerId].fta += 1;
            totals.fta += 1;
            if (payload.result === "made") {
              players[playerId].points += 1;
              totals.points += 1;
              players[playerId].ftm += 1;
              totals.ftm += 1;

              const isHome = this.isHomeTeamPayload(payload, teamContext);
              updatePlusMinus(1, isHome);
            }
          }
          if (payload.result === "made" && payload.assistPlayerId) {
            const aId = payload.assistPlayerId as string;
            ensurePlayer(aId, eventTeamId);
            players[aId].assists += 1;
            totals.assists += 1;
          }
          break;
        }
        case "assist": {
          const aId = (payload.assistPlayerId ?? payload.playerId) as
            string | undefined;
          if (aId) {
            ensurePlayer(aId, eventTeamId);
            players[aId].assists += 1;
            totals.assists += 1;
          }
          break;
        }
        case "rebound": {
          if (playerId) {
            players[playerId].rebounds += 1;
            totals.rebounds += 1;
            if (payload.type === "offensive") {
              players[playerId].oreb += 1;
              totals.oreb += 1;
            } else {
              players[playerId].dreb += 1;
              totals.dreb += 1;
            }
          }
          break;
        }
        case "foul": {
          if (playerId) {
            players[playerId].fouls += 1;
            totals.fouls += 1;
          }
          break;
        }
        case "turnover": {
          if (playerId) {
            players[playerId].turnovers += 1;
            totals.turnovers += 1;
          }
          if (payload.stealPlayerId) {
            const sId = payload.stealPlayerId as string;
            const stealTeamId =
              teamContext && eventTeamId
                ? eventTeamId === teamContext.homeTeamId
                  ? teamContext.awayTeamId
                  : teamContext.homeTeamId
                : null;
            ensurePlayer(sId, stealTeamId);
            players[sId].steals += 1;
            totals.steals += 1;
          }
          break;
        }
        default:
          break;
      }
    }

    const createEmptyTotals = (): ProjectionTotals => ({
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
    });

    const teamTotals: Record<string, ProjectionTotals> = {};
    if (teamContext?.homeTeamId) {
      teamTotals[teamContext.homeTeamId] = createEmptyTotals();
      teamTotals.home = teamTotals[teamContext.homeTeamId];
    }
    if (teamContext?.awayTeamId) {
      teamTotals[teamContext.awayTeamId] = createEmptyTotals();
      teamTotals.away = teamTotals[teamContext.awayTeamId];
    }

    for (const p of Object.values(players)) {
      p.eff =
        p.points +
        p.rebounds +
        p.assists +
        p.steals +
        p.blocks -
        (p.fga - p.fgm) -
        (p.fta - p.ftm) -
        p.turnovers;
      totals.eff += p.eff;
      totals.secondsPlayed += p.secondsPlayed;
      totals.plusMinus += p.plusMinus;

      if (p.teamId) {
        if (!teamTotals[p.teamId]) {
          teamTotals[p.teamId] = createEmptyTotals();
        }
        const t = teamTotals[p.teamId];
        t.points += p.points;
        t.rebounds += p.rebounds;
        t.assists += p.assists;
        t.blocks += p.blocks;
        t.steals += p.steals;
        t.fouls += p.fouls;
        t.turnovers += p.turnovers;
        t.fga += p.fga;
        t.fgm += p.fgm;
        t.fg3a += p.fg3a;
        t.fg3m += p.fg3m;
        t.twoPa += p.twoPa;
        t.twoPm += p.twoPm;
        t.threePa += p.threePa;
        t.threePm += p.threePm;
        t.fta += p.fta;
        t.ftm += p.ftm;
        t.oreb += p.oreb;
        t.dreb += p.dreb;
        t.plusMinus += p.plusMinus;
        t.eff += p.eff;
        t.secondsPlayed += p.secondsPlayed;
      }
    }

    return {
      players,
      totals,
      teamTotals,
      totalEvents: rawEventCount,
    };
  }

  private emptyPlayerProjection(
    playerId: string,
    teamId: string | null = null,
  ): ProjectionTotals & {
    playerId: string;
    teamId: string | null;
    name?: string | null;
    jerseyNumber?: number | null;
    photo?: string | null;
  } {
    return {
      playerId,
      teamId,
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

  private extractTimelineTeamAndPlayer(payload: Record<string, unknown>): {
    teamId: string | null;
    playerId: string | null;
  } {
    const shot = payload.shot as Record<string, unknown> | undefined;
    const teamId =
      (typeof payload.teamId === "string" ? payload.teamId : null) ||
      (typeof shot?.teamId === "string" ? shot.teamId : null) ||
      null;

    let playerId: string | null = null;
    if (typeof payload.playerId === "string") {
      playerId = payload.playerId;
    } else if (typeof payload.shooterPlayerId === "string") {
      playerId = payload.shooterPlayerId;
    } else if (typeof payload.reboundPlayerId === "string") {
      playerId = payload.reboundPlayerId;
    } else if (typeof payload.foulerPlayerId === "string") {
      playerId = payload.foulerPlayerId;
    } else if (typeof payload.turnoverPlayerId === "string") {
      playerId = payload.turnoverPlayerId;
    } else if (typeof payload.playerInId === "string") {
      playerId = payload.playerInId;
    } else if (typeof payload.assistPlayerId === "string") {
      playerId = payload.assistPlayerId;
    }

    return { teamId, playerId };
  }

  private buildTimelineDescription(
    eventType: string,
    payload: Record<string, unknown>,
  ): string {
    switch (eventType) {
      case "shot": {
        const shot = payload.shot as Record<string, unknown> | undefined;
        const val = shot?.value ?? 2;
        const res = shot?.result === "made" ? "made" : "missed";
        const type = shot?.type ? `${shot.type}` : "shot";
        return `${res} ${val}-point ${type}`;
      }
      case "free_throw": {
        const attempt = payload.attempt as number | undefined;
        const total = payload.totalAttempts as number | undefined;
        const res = payload.result === "made" ? "made" : "missed";
        if (typeof attempt === "number" && typeof total === "number") {
          return `${this.getOrdinal(attempt)} of ${total} free throws ${res}`;
        }
        return `free throw ${res}`;
      }
      case "rebound": {
        const rebound = payload.rebound as Record<string, unknown> | undefined;
        const type = rebound?.type || payload.type;
        if (type === "offensive") return "offensive rebound";
        if (type === "defensive") return "defensive rebound";
        return "rebound";
      }
      case "foul": {
        const foulType = payload.foulType ? String(payload.foulType) : "";
        return foulType ? `${foulType} foul` : "foul";
      }
      case "turnover": {
        const turnover = payload.turnover as
          Record<string, unknown> | undefined;
        const type = turnover?.type || payload.type;
        return type
          ? `${String(type).replace(/_/g, " ")} turnover`
          : "turnover";
      }
      case "dead_ball": {
        const reason = payload.reason
          ? String(payload.reason).replace(/_/g, " ")
          : "dead ball";
        return reason;
      }
      case "timeout": {
        const type = payload.timeoutType
          ? `${String(payload.timeoutType).replace(/_/g, " ")} `
          : "";
        return `${type}timeout`;
      }
      case "jump_ball":
        return "jump ball";
      case "substitution":
        return "substitution";
      case "assist":
        return "assist";
      case "period_end":
        return "END OF PERIOD";
      case "game_end":
        return "END OF GAME";
      default:
        return eventType.replace(/_/g, " ");
    }
  }

  private getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
