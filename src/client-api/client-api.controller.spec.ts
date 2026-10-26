import { Test, TestingModule } from "@nestjs/testing";
import { ClientApiController } from "./client-api.controller";
import { ClientApiService } from "./client-api.service";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { of } from "rxjs";
import { ForbiddenException } from "@nestjs/common";
import { LeaderCategory } from "./dto/client-api.dto";
import type { AppRequest } from "../common/interfaces/app.interface";
import type { MessageEvent } from "@nestjs/common";

describe("ClientApiController", () => {
  let controller: ClientApiController;
  let service: ClientApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientApiController],
      providers: [
        {
          provide: ClientApiService,
          useValue: {
            getMatches: jest.fn(),
            getMatchDetails: jest.fn(),
            getBoxScore: jest.fn(),
            getShotChart: jest.fn(),
            streamMatch: jest.fn(),
            getTeams: jest.fn(),
            getTeamDetails: jest.fn(),
            getTournaments: jest.fn(),
            getTournamentDetails: jest.fn(),
            getTournamentStandings: jest.fn(),
            getTournamentLeaders: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ClientApiController>(ClientApiController);
    service = module.get<ClientApiService>(ClientApiService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  const mockRequest = {
    user: {
      userId: "user_1",
      email: "client@example.com",
      clientIds: ["client_id_1"],
      role: "CLIENT",
    },
  } as unknown as AppRequest;

  it("should get matches for client", async () => {
    const expectedResult = [{ id: "match1" }];
    (service.getMatches as jest.Mock).mockResolvedValue(expectedResult);

    const result = await controller.getMatches(mockRequest, {});
    expect(result).toBe(expectedResult);
    expect(service.getMatches).toHaveBeenCalledWith("client_id_1", undefined);
  });

  it("should get matches for client filtered by tournamentId", async () => {
    const expectedResult = [{ id: "match1", tournamentId: "tourney_1" }];
    (service.getMatches as jest.Mock).mockResolvedValue(expectedResult);

    const result = await controller.getMatches(mockRequest, {
      tournamentId: "tourney_1",
    });
    expect(result).toBe(expectedResult);
    expect(service.getMatches).toHaveBeenCalledWith("client_id_1", "tourney_1");
  });

  it("should get teams for client", async () => {
    const expectedTeams = [{ id: "team_1", name: "Warriors" }];
    (service.getTeams as jest.Mock).mockResolvedValue(expectedTeams);

    const result = await controller.getTeams(mockRequest);
    expect(result).toBe(expectedTeams);
    expect(service.getTeams).toHaveBeenCalledWith("client_id_1");
  });

  it("should get team details and roster for client", async () => {
    const expectedTeam = { id: "team_1", name: "Warriors", roster: [] };
    (service.getTeamDetails as jest.Mock).mockResolvedValue(expectedTeam);

    const result = await controller.getTeamDetails(mockRequest, "team_1");
    expect(result).toBe(expectedTeam);
    expect(service.getTeamDetails).toHaveBeenCalledWith(
      "client_id_1",
      "team_1",
    );
  });

  it("should get tournaments for client", async () => {
    const expectedTournaments = [{ id: "tourn_1", name: "Winter Cup" }];
    (service.getTournaments as jest.Mock).mockResolvedValue(
      expectedTournaments,
    );

    const result = await controller.getTournaments(mockRequest);
    expect(result).toBe(expectedTournaments);
    expect(service.getTournaments).toHaveBeenCalledWith("client_id_1");
  });

  it("should get tournament details for client", async () => {
    const expectedTournament = { id: "tourn_1", name: "Winter Cup", teams: [] };
    (service.getTournamentDetails as jest.Mock).mockResolvedValue(
      expectedTournament,
    );

    const result = await controller.getTournamentDetails(
      mockRequest,
      "tourn_1",
    );
    expect(result).toBe(expectedTournament);
    expect(service.getTournamentDetails).toHaveBeenCalledWith(
      "client_id_1",
      "tourn_1",
    );
  });

  it("should get tournament standings for client", async () => {
    const expectedStandings = [{ teamId: "team_1", played: 1, points: 2 }];
    (service.getTournamentStandings as jest.Mock).mockResolvedValue(
      expectedStandings,
    );

    const result = await controller.getTournamentStandings(
      mockRequest,
      "tourn_1",
    );
    expect(result).toBe(expectedStandings);
    expect(service.getTournamentStandings).toHaveBeenCalledWith(
      "client_id_1",
      "tourn_1",
    );
  });

  it("should get tournament leaders for client", async () => {
    const expectedLeaders = [{ rank: 1, totalValue: 50, perGameValue: 25 }];
    (service.getTournamentLeaders as jest.Mock).mockResolvedValue(
      expectedLeaders,
    );

    const result = await controller.getTournamentLeaders(
      mockRequest,
      "tourn_1",
      { category: LeaderCategory.POINTS, limit: 10 },
    );
    expect(result).toBe(expectedLeaders);
    expect(service.getTournamentLeaders).toHaveBeenCalledWith(
      "client_id_1",
      "tourn_1",
      LeaderCategory.POINTS,
      10,
    );
  });

  it("should forbid access if querying another clientId not assigned to user", () => {
    expect(() => {
      controller.getTeams(mockRequest, "unauthorized_client");
    }).toThrow(ForbiddenException);
  });

  it("should get shot chart for client match and pass scopes", async () => {
    const expectedShotChart = [{ id: "shot_1", points: 2 }];
    (service.getShotChart as jest.Mock).mockResolvedValue(expectedShotChart);

    const result = await controller.getShotChart(mockRequest, "match_1");
    expect(result).toBe(expectedShotChart);
    expect(service.getShotChart).toHaveBeenCalledWith(
      "client_id_1",
      "match_1",
      undefined,
    );
  });

  it("should stream match events and pass scopes", (done) => {
    const mockStreamEvent: MessageEvent = { data: "test" };
    const mockPromise = Promise.resolve(of(mockStreamEvent));
    (service.streamMatch as jest.Mock).mockReturnValue(mockPromise);

    const observable = controller.streamMatch(mockRequest, "match_1", {
      sinceVersion: "10",
    });

    observable.subscribe((val) => {
      expect(val).toBe(mockStreamEvent);
      expect(service.streamMatch).toHaveBeenCalledWith(
        "client_id_1",
        "match_1",
        10,
        undefined,
      );
      done();
    });
  });
});
