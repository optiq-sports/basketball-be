import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StatdashProjectionsService } from "../statdash/projections/statdash-projections.service";
import { StatdashRealtimeService } from "../statdash/realtime/statdash-realtime.service";
import { MatchStatus } from "@prisma/client";
import { map } from "rxjs/operators";
import { MessageEvent } from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class ClientApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statdashProjectionsService: StatdashProjectionsService,
    private readonly statdashRealtimeService: StatdashRealtimeService,
  ) {}

  async getMatches(clientId: string | undefined, tournamentId?: string) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const matches = await this.prisma.match.findMany({
      where: {
        clientId,
        ...(tournamentId ? { tournamentId } : {}),
      },
      select: {
        id: true,
        status: true,
        stage: true,
        scheduledDate: true,
        homeScore: true,
        awayScore: true,
        tournamentId: true,
        venue: true,
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
        homeTeam: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
            logo: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
            logo: true,
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    return matches.map((m) => ({
      id: m.id,
      status: m.status,
      stage: m.stage ?? null,
      scheduledDate: m.scheduledDate,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      tournamentId: m.tournamentId,
      tournamentName: m.tournament?.name ?? "",
      tournament: m.tournament,
      venue: m.venue,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
    }));
  }

  async getMatchDetails(clientId: string | undefined, matchId: string) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, clientId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
        homeTeam: {
          include: {
            playerTeams: {
              where: { isActive: true },
              include: {
                player: true,
              },
              orderBy: { jerseyNumber: "asc" },
            },
          },
        },
        awayTeam: {
          include: {
            playerTeams: {
              where: { isActive: true },
              include: {
                player: true,
              },
              orderBy: { jerseyNumber: "asc" },
            },
          },
        },
        gameSessions: {
          select: {
            id: true,
            status: true,
            quarter: true,
            clockSecondsRemaining: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException("Match not found");
    }

    type TeamWithPlayerTeams = typeof match.homeTeam;

    const formatTeamWithPlayers = (team: TeamWithPlayerTeams) => {
      if (!team) return team;
      const { playerTeams, ...teamRest } = team as typeof team & {
        playerTeams?: Array<{
          jerseyNumber: number | null;
          player: {
            id: string;
            firstName: string;
            lastName: string;
            photo: string | null;
            position: string | null;
          };
        }>;
      };
      const players = (playerTeams || []).map((pt) => ({
        id: pt.player.id,
        name: `${pt.player.firstName} ${pt.player.lastName}`.trim(),
        firstName: pt.player.firstName,
        lastName: pt.player.lastName,
        jerseyNumber: pt.jerseyNumber,
        photo: pt.player.photo ?? null,
        position: pt.player.position ?? null,
      }));
      return {
        ...teamRest,
        players,
      };
    };

    return {
      ...match,
      stage: match.stage ?? null,
      tournamentName: match.tournament?.name ?? "",
      homeTeam: formatTeamWithPlayers(match.homeTeam),
      awayTeam: formatTeamWithPlayers(match.awayTeam),
    };
  }

  private async getSessionForMatch(clientId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, clientId },
      include: { gameSessions: true },
    });

    if (!match || !match.gameSessions) {
      throw new NotFoundException("Match or session not found");
    }

    return match.gameSessions;
  }

  async getBoxScore(clientId: string | undefined, matchId: string) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const session = await this.getSessionForMatch(clientId, matchId);

    // Call the internal projections service (which calculates all stats)
    const boxScore = await this.statdashProjectionsService.getBoxScore(
      session.id,
    );

    // Optionally remove any advanced analytics here if they were present
    return boxScore;
  }

  async getTimeline(clientId: string | undefined, matchId: string) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const session = await this.getSessionForMatch(clientId, matchId);
    return this.statdashProjectionsService.getTimeline(session.id);
  }

  private hasAdvancedAnalyticsScope(scopes?: string[]): boolean {
    if (!scopes || !Array.isArray(scopes)) return false;
    return scopes.some((scope) => {
      const normalized = scope.trim().toLowerCase().replace(/[- ]/g, "_");
      return (
        normalized === "advanced_analytics" ||
        normalized === "advancedanalytics" ||
        scope.trim().toLowerCase() === "advanced analytics"
      );
    });
  }

  async getShotChart(
    clientId: string | undefined,
    matchId: string,
    scopes?: string[],
  ) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const session = await this.getSessionForMatch(clientId, matchId);

    // Call internal service
    const rawShotChart = await this.statdashProjectionsService.getShotChart(
      session.id,
    );

    // If API key carries Advanced Analytics scope, return full coordinates
    if (this.hasAdvancedAnalyticsScope(scopes)) {
      return rawShotChart;
    }

    // Data Privacy: Strip out advanced stats (x, y coordinates)
    return rawShotChart.map((shot) => {
      // Create a shallow copy without x and y
      const { x, y, ...publicShot } = shot as Record<string, unknown>;
      return publicShot;
    });
  }

  async streamMatch(
    clientId: string | undefined,
    matchId: string,
    sinceVersion?: number,
    scopes?: string[],
  ): Promise<Observable<MessageEvent>> {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const session = await this.getSessionForMatch(clientId, matchId);

    // Call the internal real-time streaming service
    const stream = this.statdashRealtimeService.streamBySession(
      session.id,
      sinceVersion,
    );

    // If API key carries Advanced Analytics scope, stream full coordinates
    if (this.hasAdvancedAnalyticsScope(scopes)) {
      return stream;
    }

    // Map over the stream to strip out sensitive properties (like x, y in deltaEvents)
    return stream.pipe(
      map((event: MessageEvent) => {
        if (
          event.type === "statdash-update" &&
          event.data &&
          typeof event.data === "object"
        ) {
          const data = event.data as {
            deltaEvents?: Record<string, unknown>[];
          };
          if (Array.isArray(data.deltaEvents)) {
            data.deltaEvents = data.deltaEvents.map((deltaEvent) => {
              const { x, y, ...publicEvent } = deltaEvent;
              return publicEvent;
            });
          }
        }
        return event;
      }),
    );
  }

  async getTeams(clientId: string | undefined) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    return this.prisma.team.findMany({
      where: {
        OR: [
          {
            tournamentTeams: {
              some: {
                tournament: { clientId },
              },
            },
          },
          {
            homeMatches: {
              some: { clientId },
            },
          },
          {
            awayMatches: {
              some: { clientId },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        logo: true,
        country: true,
        state: true,
        coach: true,
        arena: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async getTeamDetails(clientId: string | undefined, teamId: string) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        OR: [
          {
            tournamentTeams: {
              some: {
                tournament: { clientId },
              },
            },
          },
          {
            homeMatches: {
              some: { clientId },
            },
          },
          {
            awayMatches: {
              some: { clientId },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        logo: true,
        country: true,
        state: true,
        coach: true,
        arena: true,
        playerTeams: {
          where: { isActive: true },
          select: {
            jerseyNumber: true,
            isCaptain: true,
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                position: true,
                height: true,
                photo: true,
                nationality: true,
              },
            },
          },
          orderBy: { jerseyNumber: "asc" },
        },
      },
    });

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    const { playerTeams, ...baseTeam } = team;
    const roster = playerTeams.map((pt) => ({
      id: pt.player.id,
      firstName: pt.player.firstName,
      lastName: pt.player.lastName,
      position: pt.player.position,
      jerseyNumber: pt.jerseyNumber,
      height: pt.player.height,
      photo: pt.player.photo,
      nationality: pt.player.nationality,
      isCaptain: pt.isCaptain,
    }));

    return {
      ...baseTeam,
      roster,
    };
  }

  async getTournaments(clientId: string | undefined) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    return this.prisma.tournament.findMany({
      where: { clientId },
      select: {
        id: true,
        name: true,
        division: true,
        format: true,
        code: true,
        startDate: true,
        endDate: true,
        venue: true,
        numberOfGames: true,
        numberOfQuarters: true,
        quarterDuration: true,
        overtimeDuration: true,
      },
      orderBy: { startDate: "desc" },
    });
  }

  async getTournamentDetails(
    clientId: string | undefined,
    tournamentId: string,
  ) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, clientId },
      select: {
        id: true,
        name: true,
        division: true,
        format: true,
        code: true,
        startDate: true,
        endDate: true,
        venue: true,
        numberOfGames: true,
        numberOfQuarters: true,
        quarterDuration: true,
        overtimeDuration: true,
        teams: {
          select: {
            group: true,
            team: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    const { teams, ...baseTournament } = tournament;
    return {
      ...baseTournament,
      teams: teams.map((t) => ({
        id: t.team.id,
        name: t.team.name,
        code: t.team.code,
        logo: t.team.logo,
        color: t.team.color ?? null,
        group: t.group,
      })),
    };
  }

  async getTournamentStandings(
    clientId: string | undefined,
    tournamentId: string,
  ) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, clientId },
      include: {
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                code: true,
                logo: true,
              },
            },
          },
        },
        matches: {
          where: {
            status: MatchStatus.COMPLETED,
          },
          orderBy: { scheduledDate: "asc" },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    type TeamStat = {
      teamId: string;
      teamName: string;
      teamCode: string;
      teamLogo: string | null;
      group: string | null;
      played: number;
      won: number;
      lost: number;
      pointsFor: number;
      pointsAgainst: number;
      pointsDiff: number;
      points: number;
      winPercentage: number;
      results: ("W" | "L")[];
    };

    const teamStats = new Map<string, TeamStat>();

    for (const tt of tournament.teams) {
      teamStats.set(tt.team.id, {
        teamId: tt.team.id,
        teamName: tt.team.name,
        teamCode: tt.team.code,
        teamLogo: tt.team.logo,
        group: tt.group ?? null,
        played: 0,
        won: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDiff: 0,
        points: 0,
        winPercentage: 0,
        results: [],
      });
    }

    for (const match of tournament.matches) {
      const home = teamStats.get(match.homeTeamId);
      const away = teamStats.get(match.awayTeamId);

      if (home) {
        home.played += 1;
        home.pointsFor += match.homeScore;
        home.pointsAgainst += match.awayScore;
        if (match.homeScore > match.awayScore) {
          home.won += 1;
          home.results.push("W");
        } else if (match.homeScore < match.awayScore) {
          home.lost += 1;
          home.results.push("L");
        }
      }

      if (away) {
        away.played += 1;
        away.pointsFor += match.awayScore;
        away.pointsAgainst += match.homeScore;
        if (match.awayScore > match.homeScore) {
          away.won += 1;
          away.results.push("W");
        } else if (match.awayScore < match.homeScore) {
          away.lost += 1;
          away.results.push("L");
        }
      }
    }

    const list = Array.from(teamStats.values()).map((stat) => {
      stat.pointsDiff = stat.pointsFor - stat.pointsAgainst;
      stat.points = stat.won * 2 + stat.lost * 1;
      stat.winPercentage =
        stat.played > 0 ? Number((stat.won / stat.played).toFixed(3)) : 0;

      let streak = "-";
      if (stat.results.length > 0) {
        const lastResult = stat.results[stat.results.length - 1];
        let count = 0;
        for (let i = stat.results.length - 1; i >= 0; i--) {
          if (stat.results[i] === lastResult) count++;
          else break;
        }
        streak = `${lastResult}${count}`;
      }

      return {
        teamId: stat.teamId,
        teamName: stat.teamName,
        teamCode: stat.teamCode,
        teamLogo: stat.teamLogo,
        group: stat.group,
        played: stat.played,
        won: stat.won,
        lost: stat.lost,
        pointsFor: stat.pointsFor,
        pointsAgainst: stat.pointsAgainst,
        pointsDiff: stat.pointsDiff,
        points: stat.points,
        winPercentage: stat.winPercentage,
        streak,
      };
    });

    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      return b.pointsFor - a.pointsFor;
    });

    return list.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));
  }

  async getTournamentLeaders(
    clientId: string | undefined,
    tournamentId: string,
    category: string = "points",
    limit: number = 10,
  ) {
    if (!clientId) throw new NotFoundException("Client ID is missing");
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, clientId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    const validCategories = [
      "points",
      "rebounds",
      "assists",
      "steals",
      "blocks",
      "turnovers",
      "fg3m",
    ];
    const cat = validCategories.includes(category) ? category : "points";

    const stats = await this.prisma.matchStat.findMany({
      where: {
        match: {
          tournamentId,
          status: MatchStatus.COMPLETED,
        },
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
          },
        },
      },
    });

    const teamIds = Array.from(new Set(stats.map((s) => s.teamId)));
    const teams =
      teamIds.length > 0
        ? await this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true, code: true },
          })
        : [];
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    type PlayerAgg = {
      playerId: string;
      firstName: string;
      lastName: string;
      photo: string | null;
      teamId: string;
      teamName: string;
      teamCode: string;
      matchIds: Set<string>;
      totals: Record<string, number>;
    };

    const aggMap = new Map<string, PlayerAgg>();

    for (const stat of stats) {
      const team = teamMap.get(stat.teamId) || {
        id: stat.teamId,
        name: "Unknown",
        code: "UNK",
      };

      if (!aggMap.has(stat.playerId)) {
        aggMap.set(stat.playerId, {
          playerId: stat.playerId,
          firstName: stat.player.firstName,
          lastName: stat.player.lastName,
          photo: stat.player.photo,
          teamId: team.id,
          teamName: team.name,
          teamCode: team.code,
          matchIds: new Set<string>(),
          totals: {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            fg3m: 0,
          },
        });
      }

      const p = aggMap.get(stat.playerId)!;
      p.matchIds.add(stat.matchId);
      for (const validCat of validCategories) {
        p.totals[validCat] =
          (p.totals[validCat] || 0) +
          ((stat as unknown as Record<string, number>)[validCat] || 0);
      }
    }

    const playerAggEntries = Array.from(aggMap.values());
    const playerTeams =
      playerAggEntries.length > 0
        ? await this.prisma.playerTeam.findMany({
            where: {
              OR: playerAggEntries.map((p) => ({
                playerId: p.playerId,
                teamId: p.teamId,
              })),
              isActive: true,
            },
            select: {
              playerId: true,
              teamId: true,
              jerseyNumber: true,
            },
          })
        : [];
    const jerseyMap = new Map<string, number>();
    for (const pt of playerTeams) {
      jerseyMap.set(`${pt.playerId}_${pt.teamId}`, pt.jerseyNumber);
    }

    const buildCategoryLeaders = (targetCategory: string) => {
      const leaders = playerAggEntries
        .map((p) => {
          const gamesPlayed = p.matchIds.size;
          const totalValue = p.totals[targetCategory] || 0;
          const perGameValue =
            gamesPlayed > 0 ? Number((totalValue / gamesPlayed).toFixed(1)) : 0;
          return {
            playerId: p.playerId,
            firstName: p.firstName,
            lastName: p.lastName,
            jerseyNumber: jerseyMap.get(`${p.playerId}_${p.teamId}`) ?? null,
            photo: p.photo,
            teamId: p.teamId,
            teamName: p.teamName,
            teamCode: p.teamCode,
            gamesPlayed,
            totalValue,
            perGameValue,
          };
        })
        .sort((a, b) => {
          if (b.perGameValue !== a.perGameValue)
            return b.perGameValue - a.perGameValue;
          return b.totalValue - a.totalValue;
        })
        .slice(0, limit);

      return leaders.map((item, index) => ({
        rank: index + 1,
        ...item,
      }));
    };

    if (category === "all") {
      return {
        points: buildCategoryLeaders("points"),
        rebounds: buildCategoryLeaders("rebounds"),
        assists: buildCategoryLeaders("assists"),
        steals: buildCategoryLeaders("steals"),
        blocks: buildCategoryLeaders("blocks"),
        turnovers: buildCategoryLeaders("turnovers"),
        fg3m: buildCategoryLeaders("fg3m"),
      };
    }

    const targetCat = validCategories.includes(category) ? category : "points";
    return buildCategoryLeaders(targetCat);
  }

  async getPlayerCard(clientId: string | undefined, playerId: string) {
    if (!clientId) throw new NotFoundException("Client ID is missing");

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        playerTeams: {
          where: { isActive: true },
          include: {
            team: {
              include: {
                tournamentTeams: {
                  where: {
                    tournament: { clientId },
                  },
                  include: {
                    tournament: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException("Player not found");
    }

    const clientPlayerTeams = player.playerTeams.filter(
      (pt) => pt.team.tournamentTeams.length > 0,
    );

    const clientStats = await this.prisma.matchStat.findMany({
      where: {
        playerId,
        match: {
          tournament: { clientId },
        },
      },
      include: {
        match: {
          select: {
            id: true,
            tournamentId: true,
            tournament: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (clientPlayerTeams.length === 0 && clientStats.length === 0) {
      throw new NotFoundException("Player not found in client tournaments");
    }

    const primaryPt = clientPlayerTeams[0];
    const currentTeam = primaryPt
      ? {
          id: primaryPt.team.id,
          name: primaryPt.team.name,
          code: primaryPt.team.code,
          logo: primaryPt.team.logo,
          color: primaryPt.team.color,
        }
      : null;
    const jerseyNumber = primaryPt ? primaryPt.jerseyNumber : null;

    type TourneyAgg = {
      tournamentId: string;
      tournamentName: string;
      matchIds: Set<string>;
      totals: {
        points: number;
        rebounds: number;
        assists: number;
        steals: number;
        blocks: number;
        fgm: number;
        fga: number;
        fg3m: number;
        fg3a: number;
        ftm: number;
        fta: number;
      };
    };

    const tourneyMap = new Map<string, TourneyAgg>();

    for (const stat of clientStats) {
      const tId = stat.match.tournamentId;
      const tName = stat.match.tournament?.name ?? "";
      if (!tourneyMap.has(tId)) {
        tourneyMap.set(tId, {
          tournamentId: tId,
          tournamentName: tName,
          matchIds: new Set<string>(),
          totals: {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            fgm: 0,
            fga: 0,
            fg3m: 0,
            fg3a: 0,
            ftm: 0,
            fta: 0,
          },
        });
      }

      const agg = tourneyMap.get(tId)!;
      agg.matchIds.add(stat.match.id);
      agg.totals.points += stat.points;
      agg.totals.rebounds += stat.rebounds;
      agg.totals.assists += stat.assists;
      agg.totals.steals += stat.steals;
      agg.totals.blocks += stat.blocks;
      agg.totals.fgm += stat.fgm;
      agg.totals.fga += stat.fga;
      agg.totals.fg3m += stat.fg3m;
      agg.totals.fg3a += stat.fg3a;
      agg.totals.ftm += stat.ftm;
      agg.totals.fta += stat.fta;
    }

    const seasonLines = Array.from(tourneyMap.values()).map((agg) => {
      const gamesPlayed = agg.matchIds.size;
      const round = (val: number) =>
        gamesPlayed > 0 ? Number((val / gamesPlayed).toFixed(1)) : 0;

      return {
        tournamentId: agg.tournamentId,
        tournamentName: agg.tournamentName,
        gamesPlayed,
        totals: { ...agg.totals },
        averages: {
          points: round(agg.totals.points),
          rebounds: round(agg.totals.rebounds),
          assists: round(agg.totals.assists),
          steals: round(agg.totals.steals),
          blocks: round(agg.totals.blocks),
          fgm: round(agg.totals.fgm),
          fga: round(agg.totals.fga),
          fg3m: round(agg.totals.fg3m),
          fg3a: round(agg.totals.fg3a),
          ftm: round(agg.totals.ftm),
          fta: round(agg.totals.fta),
        },
      };
    });

    return {
      id: player.id,
      name: `${player.firstName} ${player.lastName}`.trim(),
      firstName: player.firstName,
      lastName: player.lastName,
      photo: player.photo ?? null,
      position: player.position ?? null,
      height: player.height ?? null,
      nationality: player.nationality ?? null,
      currentTeam,
      jerseyNumber,
      tournaments: seasonLines,
    };
  }
}
