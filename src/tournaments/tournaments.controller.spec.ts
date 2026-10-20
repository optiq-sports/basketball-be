import { Test, TestingModule } from "@nestjs/testing";
import { TournamentsController } from "./tournaments.controller";
import { TournamentsService } from "./tournaments.service";
import { Role, TournamentDivision } from "@prisma/client";
import type { AuthenticatedUser } from "../common/interfaces/user.interface";
import { TournamentFilterDto } from "./dto/tournament-filter.dto";
import {
  PaginatedResponseDto,
  PageMetaDto,
} from "../common/dto/paginated-response.dto";
import { TournamentResponseDto } from "./dto/tournament-response.dto";
import { UPLOAD_PROVIDER } from "../upload/upload.constants";

describe("TournamentsController", () => {
  let controller: TournamentsController;
  let service: TournamentsService;

  const mockTournamentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    addTeams: jest.fn(),
    removeTeam: jest.fn(),
    updateFlyer: jest.fn(),
    remove: jest.fn(),
  };

  const mockUploadProvider = {
    upload: jest.fn(),
    delete: jest.fn(),
    getUrl: jest.fn(),
  };

  const mockUser: AuthenticatedUser = {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin",
    role: Role.ADMIN,
    clientIds: ["client-1"],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentsController],
      providers: [
        {
          provide: TournamentsService,
          useValue: mockTournamentsService,
        },
        {
          provide: UPLOAD_PROVIDER,
          useValue: mockUploadProvider,
        },
      ],
    }).compile();

    controller = module.get<TournamentsController>(TournamentsController);
    service = module.get<TournamentsService>(TournamentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should pass user and filterDto to service.findAll", async () => {
      const mockResult: PaginatedResponseDto<TournamentResponseDto> = {
        items: [],
        meta: new PageMetaDto({ page: 1, limit: 10, itemCount: 0 }),
      };
      mockTournamentsService.findAll.mockResolvedValue(mockResult);

      const filterDto: TournamentFilterDto = {
        page: 1,
        limit: 10,
        sortBy: "name",
        sortOrder: "asc",
      };

      const result = await controller.findAll(mockUser, filterDto);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, filterDto);
      expect(result).toBe(mockResult);
    });
  });

  describe("findOne", () => {
    it("should call service.findOne", async () => {
      const mockTournament = { id: "t1", name: "Cup" };
      mockTournamentsService.findOne.mockResolvedValue(mockTournament);

      const result = await controller.findOne("t1", mockUser);

      expect(service.findOne).toHaveBeenCalledWith("t1", mockUser);
      expect(result).toEqual(mockTournament);
    });
  });

  describe("findByCode", () => {
    it("should call service.findByCode", async () => {
      const mockTournament = { id: "t1", code: "CODE12" };
      mockTournamentsService.findByCode.mockResolvedValue(mockTournament);

      const result = await controller.findByCode("CODE12");

      expect(service.findByCode).toHaveBeenCalledWith("CODE12");
      expect(result).toEqual(mockTournament);
    });
  });

  describe("create", () => {
    it("should call service.create", async () => {
      const createDto = {
        name: "New League",
        division: TournamentDivision.PREMIER,
        startDate: "2026-05-01",
        numberOfGames: 10,
        quarterDuration: 10,
      };
      const mockTournament = { id: "t1", ...createDto };
      mockTournamentsService.create.mockResolvedValue(mockTournament);

      const result = await controller.create(createDto, mockUser);

      expect(service.create).toHaveBeenCalledWith(createDto, mockUser);
      expect(result).toEqual(mockTournament);
    });
  });
});
