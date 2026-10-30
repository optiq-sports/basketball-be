import { Test, TestingModule } from "@nestjs/testing";
import { ClientApiService } from "./client-api.service";
import { PrismaService } from "../prisma/prisma.service";
import { StatdashProjectionsService } from "../statdash/projections/statdash-projections.service";
import { StatdashRealtimeService } from "../statdash/realtime/statdash-realtime.service";
import { NotFoundException } from "@nestjs/common";
import { of } from "rxjs";
import { LeaderCategory } from "./dto/client-api.dto";

describe("ClientApiService", () => {
  let service: ClientApiService;
  let prisma: PrismaService;
  let projectionsService: StatdashProjectionsService;
  let realtimeService: StatdashRealtimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientApiService,
        {
          provide: PrismaService,
          useValue: {
            match: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            team: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            tournament: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            matchStat: {
              findMany: jest.fn(),
            },
            playerTeam: {
              findMany: jest.fn(),
            },
            player: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: StatdashProjectionsService,
          useValue: {
            getBoxScore: jest.fn(),
            getShotChart: jest.fn(),
            getTimeline: jest.fn(),
          },
        },
        {
          provide: StatdashRealtimeService,
          useValue: {
            streamBySession: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClientApiService>(ClientApiService);
    prisma = module.get<PrismaService>(PrismaService);
    projectionsService = module.get<StatdashProjectionsService>(
      StatdashProjectionsService,
    );
    realtimeService = module.get<StatdashRealtimeService>(
      StatdashRealtimeService,
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getMatches", () => {
    it("should throw if clientId is missing", async () => {
      await expect(service.getMatches(undefined)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return matches for a client", async () => {
      const mockDbMatches = [
        {
          id: "match1",
          status: "SCHEDULED",
          scheduledDate: new Date("2026-10-25T19:00:00.000Z"),
          homeScore: 0,
          awayScore: 0,
          tournamentId: "tourney_1",
          venue: "Main Court",
          tournament: { id: "tourney_1", name: "Summer League" },
          homeTeam: {
            id: "t1",
            name: "Lakers",
            code: "LAL",
            color: "#552583",
            logo: "lakers.png",
          },
          awayTeam: {
            id: "t2",
            name: "Celtics",
            code: "BOS",
            color: "#007A33",
            logo: "celtics.png",
          },
        },
      ];
      (prisma.match.findMany as jest.Mock).mockResolvedValue(mockDbMatches);

      const result = await service.getMatches("client1");
      expect(result).toEqual([
        {
          id: "match1",
          status: "SCHEDULED",
          stage: null,
          scheduledDate: new Date("2026-10-25T19:00:00.000Z"),
          homeScore: 0,
          awayScore: 0,
          tournamentId: "tourney_1",
          tournamentName: "Summer League",
          tournament: { id: "tourney_1", name: "Summer League" },
          venue: "Main Court",
          homeTeam: {
            id: "t1",
            name: "Lakers",
            code: "LAL",
            color: "#552583",
            logo: "lakers.png",
          },
          awayTeam: {
            id: "t2",
            name: "Celtics",
            code: "BOS",
            color: "#007A33",
            logo: "celtics.png",
          },
        },
      ]);
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: { clientId: "client1" },
        select: expect.any(Object),
        orderBy: { scheduledDate: "asc" },
      });
    });

    it("should filter matches by tournamentId when provided", async () => {
      (prisma.match.findMany as jest.Mock).mockResolvedValue([]);

      await service.getMatches("client1", "tourney_123");
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: { clientId: "client1", tournamentId: "tourney_123" },
        select: expect.any(Object),
        orderBy: { scheduledDate: "asc" },
      });
    });
  });

  describe("getMatchDetails", () => {
    it("should throw if clientId is missing", async () => {
      await expect(
        service.getMatchDetails(undefined, "match1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if match not found", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.getMatchDetails("client1", "match1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return match details with rosters", async () => {
      const mockMatch = {
        id: "match1",
        tournament: { id: "tourney_1", name: "Summer League" },
        homeTeam: {
          id: "team_home",
          playerTeams: [
            {
              jerseyNumber: 23,
              player: {
                id: "player_1",
                firstName: "LeBron",
                lastName: "James",
                photo: "photo.jpg",
                position: "F",
              },
            },
          ],
        },
        awayTeam: {
          id: "team_away",
          playerTeams: [],
        },
      };
      (prisma.match.findFirst as jest.Mock).mockResolvedValue(mockMatch);

      const result = await service.getMatchDetails("client1", "match1");
      expect(result).toEqual({
        id: "match1",
        stage: null,
        tournament: { id: "tourney_1", name: "Summer League" },
        tournamentName: "Summer League",
        homeTeam: {
          id: "team_home",
          players: [
            {
              id: "player_1",
              name: "LeBron James",
              firstName: "LeBron",
              lastName: "James",
              jerseyNumber: 23,
              photo: "photo.jpg",
              position: "F",
            },
          ],
        },
        awayTeam: {
          id: "team_away",
          players: [],
        },
      });
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: { id: "match1", clientId: "client1" },
        include: expect.any(Object),
      });
    });
  });

  describe("getTeams", () => {
    it("should throw if clientId is missing", async () => {
      await expect(service.getTeams(undefined)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return client teams", async () => {
      const mockTeams = [
        {
          id: "team_1",
          name: "Warriors",
          code: "WAR",
          logo: "https://example.com/logo.png",
          color: "#000",
          country: "USA",
          state: "CA",
          coach: "Steve Kerr",
          arena: "Chase Center",
        },
      ];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const result = await service.getTeams("client_1");
      expect(result).toEqual(mockTeams);
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        select: expect.any(Object),
        orderBy: { name: "asc" },
      });
    });
  });

  describe("getTeamDetails", () => {
    it("should throw if clientId is missing", async () => {
      await expect(service.getTeamDetails(undefined, "team_1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw if team does not belong to client or not found", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.getTeamDetails("client_1", "team_1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return team detail with roster", async () => {
      const mockTeam = {
        id: "team_1",
        name: "Lakers",
        code: "LAL",
        logo: null,
        color: "#552583",
        country: "USA",
        state: "CA",
        coach: "JJ Redick",
        arena: "Crypto.com Arena",
        playerTeams: [
          {
            jerseyNumber: 23,
            isCaptain: true,
            player: {
              id: "player_1",
              firstName: "LeBron",
              lastName: "James",
              position: "FORWARD",
              height: "6'9\"",
              photo: "https://example.com/lebron.jpg",
              nationality: "USA",
            },
          },
        ],
      };
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(mockTeam);

      const result = await service.getTeamDetails("client_1", "team_1");
      expect(result.id).toBe("team_1");
      expect(result.roster).toHaveLength(1);
      expect(result.roster[0]).toEqual({
        id: "player_1",
        firstName: "LeBron",
        lastName: "James",
        jerseyNumber: 23,
        position: "FORWARD",
        height: "6'9\"",
        photo: "https://example.com/lebron.jpg",
        nationality: "USA",
        isCaptain: true,
      });
    });
  });

  describe("getTournaments", () => {
    it("should throw if clientId is missing", async () => {
      await expect(service.getTournaments(undefined)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return client tournaments", async () => {
      const mockTournaments = [
        {
          id: "tourn_1",
          name: "Winter Cup 2026",
          division: "DIVISION_1",
          format: "ROUND_ROBIN",
          code: "WC2026",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-03-01"),
          venue: "Main Arena",
          numberOfGames: 28,
          numberOfQuarters: 4,
          quarterDuration: 10,
          overtimeDuration: 5,
        },
      ];
      (prisma.tournament.findMany as jest.Mock).mockResolvedValue(
        mockTournaments,
      );

      const result = await service.getTournaments("client_1");
      expect(result).toEqual(mockTournaments);
      expect(prisma.tournament.findMany).toHaveBeenCalledWith({
        where: { clientId: "client_1" },
        select: expect.any(Object),
        orderBy: { startDate: "desc" },
      });
    });
  });

  describe("getTournamentDetails", () => {
    it("should throw if clientId is missing", async () => {
      await expect(
        service.getTournamentDetails(undefined, "tourn_1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if tournament not found", async () => {
      (prisma.tournament.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.getTournamentDetails("client_1", "tourn_1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return tournament details with teams", async () => {
      const mockTournament = {
        id: "tourn_1",
        name: "Winter Cup 2026",
        division: "DIVISION_1",
        format: "ROUND_ROBIN",
        code: "WC2026",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-01"),
        venue: "Main Arena",
        numberOfGames: 28,
        numberOfQuarters: 4,
        quarterDuration: 10,
        overtimeDuration: 5,
        teams: [
          {
            group: "Group A",
            team: {
              id: "team_1",
              name: "Warriors",
              code: "WAR",
              logo: null,
            },
          },
        ],
      };
      (prisma.tournament.findFirst as jest.Mock).mockResolvedValue(
        mockTournament,
      );

      const result = await service.getTournamentDetails("client_1", "tourn_1");
      expect(result.id).toBe("tourn_1");
      expect(result.teams).toEqual([
        {
          id: "team_1",
          name: "Warriors",
          code: "WAR",
          logo: null,
          color: null,
          group: "Group A",
        },
      ]);
    });
  });

  describe("getTournamentStandings", () => {
    it("should calculate correct standings from completed matches", async () => {
      const mockTournament = {
        id: "tourn_1",
        teams: [
          {
            team: {
              id: "team_1",
              name: "Team A",
              code: "A",
              logo: null,
            },
          },
          {
            team: {
              id: "team_2",
              name: "Team B",
              code: "B",
              logo: null,
            },
          },
        ],
        matches: [
          {
            id: "m_1",
            homeTeamId: "team_1",
            awayTeamId: "team_2",
            homeScore: 90,
            awayScore: 80,
            scheduledDate: new Date("2026-01-10"),
          },
        ],
      };
      (prisma.tournament.findFirst as jest.Mock).mockResolvedValue(
        mockTournament,
      );

      const standings = await service.getTournamentStandings(
        "client_1",
        "tourn_1",
      );
      expect(standings).toHaveLength(2);

      // Team A won
      const teamA = standings.find((s) => s.teamId === "team_1");
      expect(teamA).toBeDefined();
      expect(teamA?.played).toBe(1);
      expect(teamA?.won).toBe(1);
      expect(teamA?.lost).toBe(0);
      expect(teamA?.pointsFor).toBe(90);
      expect(teamA?.pointsAgainst).toBe(80);
      expect(teamA?.pointsDiff).toBe(10);
      expect(teamA?.points).toBe(2);
      expect(teamA?.streak).toBe("W1");

      // Team B lost
      const teamB = standings.find((s) => s.teamId === "team_2");
      expect(teamB).toBeDefined();
      expect(teamB?.played).toBe(1);
      expect(teamB?.won).toBe(0);
      expect(teamB?.lost).toBe(1);
      expect(teamB?.pointsFor).toBe(80);
      expect(teamB?.pointsAgainst).toBe(90);
      expect(teamB?.pointsDiff).toBe(-10);
      expect(teamB?.points).toBe(1);
      expect(teamB?.streak).toBe("L1");
    });
  });

  describe("getTournamentLeaders", () => {
    it("should return ranked leaders for points", async () => {
      (prisma.tournament.findFirst as jest.Mock).mockResolvedValue({
        id: "tourn_1",
      });

      (prisma.matchStat.findMany as jest.Mock).mockResolvedValue([
        {
          matchId: "m_1",
          playerId: "player_1",
          teamId: "t_1",
          points: 30,
          rebounds: 5,
          assists: 8,
          steals: 2,
          blocks: 1,
          turnovers: 2,
          fg3m: 4,
          player: {
            id: "player_1",
            firstName: "Stephen",
            lastName: "Curry",
            photo: null,
          },
          team: {
            id: "t_1",
            name: "Warriors",
            code: "WAR",
          },
        },
        {
          matchId: "m_2",
          playerId: "player_1",
          teamId: "t_1",
          points: 20,
          rebounds: 5,
          assists: 4,
          steals: 2,
          blocks: 1,
          turnovers: 1,
          fg3m: 3,
          player: {
            id: "player_1",
            firstName: "Stephen",
            lastName: "Curry",
            photo: null,
          },
          team: {
            id: "t_1",
            name: "Warriors",
            code: "WAR",
          },
        },
        {
          matchId: "m_1",
          playerId: "player_2",
          teamId: "t_2",
          points: 25,
          rebounds: 10,
          assists: 5,
          steals: 1,
          blocks: 1,
          turnovers: 3,
          fg3m: 1,
          player: {
            id: "player_2",
            firstName: "LeBron",
            lastName: "James",
            photo: null,
          },
          team: {
            id: "t_2",
            name: "Lakers",
            code: "LAL",
          },
        },
      ]);

      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { id: "t_1", name: "Warriors", code: "WAR" },
        { id: "t_2", name: "Lakers", code: "LAL" },
      ]);

      (prisma.playerTeam.findMany as jest.Mock).mockResolvedValue([
        { playerId: "player_1", teamId: "t_1", jerseyNumber: 30 },
        { playerId: "player_2", teamId: "t_2", jerseyNumber: 23 },
      ]);

      const leaders = await service.getTournamentLeaders(
        "client_1",
        "tourn_1",
        LeaderCategory.POINTS,
        5,
      );

      expect(leaders).toHaveLength(2);
      expect(leaders[0].lastName).toBe("Curry");
      expect(leaders[0].jerseyNumber).toBe(30);
      expect(leaders[0].totalValue).toBe(50);
      expect(leaders[0].gamesPlayed).toBe(2);
      expect(leaders[0].perGameValue).toBe(25);
      expect(leaders[0].rank).toBe(1);

      expect(leaders[1].lastName).toBe("James");
      expect(leaders[1].jerseyNumber).toBe(23);
      expect(leaders[1].totalValue).toBe(25);
      expect(leaders[1].gamesPlayed).toBe(1);
      expect(leaders[1].perGameValue).toBe(25);
      expect(leaders[1].rank).toBe(2);
    });
  });

  describe("getShotChart (Data Privacy)", () => {
    it("should strip out advanced stats (x, y coordinates) when advanced_analytics scope is not present", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: "match1",
        gameSessions: { id: "session1" },
      });

      const rawShotChart = [
        { id: "shot1", type: "MAKE", points: 2, x: 10, y: 20 },
        { id: "shot2", type: "MISS", points: 3, x: 50, y: 80 },
      ];

      (projectionsService.getShotChart as jest.Mock).mockResolvedValue(
        rawShotChart,
      );

      const result = await service.getShotChart("client1", "match1");

      expect(result).toEqual([
        { id: "shot1", type: "MAKE", points: 2 },
        { id: "shot2", type: "MISS", points: 3 },
      ]);
    });

    it("should retain advanced stats (x, y coordinates) when advanced_analytics scope is present", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: "match1",
        gameSessions: { id: "session1" },
      });

      const rawShotChart = [
        { id: "shot1", type: "MAKE", points: 2, x: 10, y: 20 },
        { id: "shot2", type: "MISS", points: 3, x: 50, y: 80 },
      ];

      (projectionsService.getShotChart as jest.Mock).mockResolvedValue(
        rawShotChart,
      );

      const result = await service.getShotChart("client1", "match1", [
        "advanced_analytics",
      ]);

      expect(result).toEqual(rawShotChart);
    });

    it("should retain coordinates when scope is formatted as 'Advanced Analytics'", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: "match1",
        gameSessions: { id: "session1" },
      });

      const rawShotChart = [
        { id: "shot1", type: "MAKE", points: 2, x: 10, y: 20 },
      ];

      (projectionsService.getShotChart as jest.Mock).mockResolvedValue(
        rawShotChart,
      );

      const result = await service.getShotChart("client1", "match1", [
        "Advanced Analytics",
      ]);

      expect(result).toEqual(rawShotChart);
    });
  });

  describe("streamMatch (Data Privacy)", () => {
    it("should strip x, y coordinates from real-time delta events when scope is missing", (done) => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: "match1",
        gameSessions: { id: "session1" },
      });

      const mockEvent = {
        type: "statdash-update",
        data: {
          deltaEvents: [
            { id: "event1", eventType: "SHOT", x: 100, y: 200, points: 2 },
            { id: "event2", eventType: "FOUL", player: "p1" },
          ],
        },
      };

      (realtimeService.streamBySession as jest.Mock).mockReturnValue(
        of(mockEvent),
      );

      service.streamMatch("client1", "match1").then((stream) => {
        stream.subscribe((event) => {
          const data = event.data as Record<string, unknown>;
          expect(data.deltaEvents).toEqual([
            { id: "event1", eventType: "SHOT", points: 2 },
            { id: "event2", eventType: "FOUL", player: "p1" },
          ]);
          done();
        });
      });
    });

    it("should retain x, y coordinates in stream when advanced_analytics scope is present", (done) => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: "match1",
        gameSessions: { id: "session1" },
      });

      const mockEvent = {
        type: "statdash-update",
        data: {
          deltaEvents: [
            { id: "event1", eventType: "SHOT", x: 100, y: 200, points: 2 },
            { id: "event2", eventType: "FOUL", player: "p1" },
          ],
        },
      };

      (realtimeService.streamBySession as jest.Mock).mockReturnValue(
        of(mockEvent),
      );

      service
        .streamMatch("client1", "match1", undefined, ["advanced_analytics"])
        .then((stream) => {
          stream.subscribe((event) => {
            const data = event.data as Record<string, unknown>;
            expect(data.deltaEvents).toEqual([
              { id: "event1", eventType: "SHOT", x: 100, y: 200, points: 2 },
              { id: "event2", eventType: "FOUL", player: "p1" },
            ]);
            done();
          });
        });
    });
  });

  describe("getTimeline", () => {
    it("should throw 404 if match or session does not exist (before tip-off)", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getTimeline("client1", "match1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return timeline events from projections service including payload", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: "match1",
        gameSessions: { id: "session1" },
      });

      const mockTimeline = [
        {
          sequence: 1,
          period: 1,
          clockSecondsRemaining: 710,
          eventType: "shot",
          homeScore: 2,
          awayScore: 0,
          payload: { shooterPlayerId: "p1", points: 2 },
        },
      ];
      (projectionsService.getTimeline as jest.Mock).mockResolvedValue(
        mockTimeline,
      );

      const result = await service.getTimeline("client1", "match1");
      expect(result).toEqual(mockTimeline);
    });
  });

  describe("getPlayerCard", () => {
    it("should throw NotFoundException if player not in client tournaments", async () => {
      (prisma.player.findUnique as jest.Mock).mockResolvedValue({
        id: "p_outside",
        firstName: "Outside",
        lastName: "Player",
        playerTeams: [],
      });
      (prisma.matchStat.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.getPlayerCard("client1", "p_outside"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return player card and season lines for client tournament", async () => {
      (prisma.player.findUnique as jest.Mock).mockResolvedValue({
        id: "p1",
        firstName: "LeBron",
        lastName: "James",
        photo: "photo.jpg",
        position: "Forward",
        height: "6'9\"",
        nationality: "USA",
        playerTeams: [
          {
            jerseyNumber: 23,
            team: {
              id: "t1",
              name: "Lakers",
              code: "LAL",
              logo: "logo.png",
              color: "#552583",
              tournamentTeams: [
                {
                  tournament: {
                    id: "tourn1",
                    clientId: "client1",
                  },
                },
              ],
            },
          },
        ],
      });

      (prisma.matchStat.findMany as jest.Mock).mockResolvedValue([
        {
          matchId: "m1",
          playerId: "p1",
          points: 30,
          rebounds: 8,
          assists: 10,
          steals: 2,
          blocks: 1,
          fgm: 11,
          fga: 18,
          fg3m: 3,
          fg3a: 6,
          ftm: 5,
          fta: 6,
          match: {
            id: "m1",
            tournamentId: "tourn1",
            tournament: { id: "tourn1", name: "Summer League" },
          },
        },
      ]);

      const result = await service.getPlayerCard("client1", "p1");
      expect(result.id).toBe("p1");
      expect(result.name).toBe("LeBron James");
      expect(result.jerseyNumber).toBe(23);
      expect(result.currentTeam?.name).toBe("Lakers");
      expect(result.tournaments).toHaveLength(1);
      expect(result.tournaments[0].tournamentName).toBe("Summer League");
      expect(result.tournaments[0].gamesPlayed).toBe(1);
      expect(result.tournaments[0].totals.points).toBe(30);
      expect(result.tournaments[0].averages.points).toBe(30);
      expect(result.tournaments[0].averages.assists).toBe(10);
    });
  });

  describe("getTournamentLeaders category=all", () => {
    it("should return all categories when category=all", async () => {
      (prisma.tournament.findFirst as jest.Mock).mockResolvedValue({
        id: "tourn_1",
      });

      (prisma.matchStat.findMany as jest.Mock).mockResolvedValue([
        {
          matchId: "m_1",
          playerId: "p_1",
          points: 20,
          rebounds: 10,
          assists: 5,
          steals: 2,
          blocks: 3,
          turnovers: 1,
          fg3m: 2,
          player: {
            id: "p_1",
            firstName: "Anthony",
            lastName: "Davis",
            photo: null,
          },
          team: {
            id: "t_1",
            name: "Lakers",
            code: "LAL",
          },
        },
      ]);

      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { id: "t_1", name: "Lakers", code: "LAL" },
      ]);

      (prisma.playerTeam.findMany as jest.Mock).mockResolvedValue([
        { playerId: "p_1", teamId: "t_1", jerseyNumber: 3 },
      ]);

      const result = (await service.getTournamentLeaders(
        "client_1",
        "tourn_1",
        "all" as LeaderCategory,
        5,
      )) as Record<string, unknown[]>;

      expect(result.points).toBeDefined();
      expect(result.rebounds).toBeDefined();
      expect(result.assists).toBeDefined();
      expect(result.steals).toBeDefined();
      expect(result.blocks).toBeDefined();
      expect(result.turnovers).toBeDefined();
      expect(result.fg3m).toBeDefined();
      expect((result.points[0] as { totalValue: number }).totalValue).toBe(20);
      expect((result.rebounds[0] as { totalValue: number }).totalValue).toBe(
        10,
      );
    });
  });
});
