import { Test, TestingModule } from "@nestjs/testing";
import { MatchesService } from "./matches.service";
import { PrismaService } from "../prisma/prisma.service";
import { MatchStatus } from "@prisma/client";
import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("MatchesService", () => {
  let service: MatchesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    match: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tournament: {
      findUnique: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    tournamentTeam: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createDto = {
      tournamentId: "tour1",
      homeTeamId: "team1",
      awayTeamId: "team2",
      scheduledDate: "2026-01-01T00:00:00Z",
    };

    it("should throw NotFoundException if tournament not found", async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);
      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if home team not found", async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({});
      mockPrismaService.team.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({});
      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if home team is not in tournament", async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({});
      mockPrismaService.team.findUnique.mockResolvedValue({});
      mockPrismaService.tournamentTeam.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({});
      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if teams are the same", async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({});
      mockPrismaService.team.findUnique.mockResolvedValue({});
      mockPrismaService.tournamentTeam.findUnique.mockResolvedValue({});
      await expect(
        service.create({
          ...createDto,
          homeTeamId: "team1",
          awayTeamId: "team1",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create match successfully", async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({});
      mockPrismaService.team.findUnique.mockResolvedValue({});
      mockPrismaService.tournamentTeam.findUnique.mockResolvedValue({});
      mockPrismaService.match.create.mockResolvedValue({ id: "match1" });

      const result = await service.create(createDto);
      expect(result).toEqual({ id: "match1" });
      expect(mockPrismaService.match.create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should find all matches with optional filters", async () => {
      mockPrismaService.match.findMany.mockResolvedValue([{ id: "m1" }]);
      const result = await service.findAll("tour1", MatchStatus.LIVE);
      expect(result).toEqual([{ id: "m1" }]);
      expect(mockPrismaService.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId: "tour1", status: MatchStatus.LIVE },
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should throw NotFoundException if match not found", async () => {
      mockPrismaService.match.findUnique.mockResolvedValue(null);
      await expect(service.findOne("invalid")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return match if found", async () => {
      mockPrismaService.match.findUnique.mockResolvedValue({ id: "m1" });
      const result = await service.findOne("m1");
      expect(result).toEqual({ id: "m1" });
    });
  });

  describe("update", () => {
    it("should calculate scores and update match", async () => {
      mockPrismaService.match.findUnique.mockResolvedValue({
        id: "m1",
        quarter1Home: 10,
        quarter2Home: 10,
      });
      mockPrismaService.match.update.mockResolvedValue({ id: "m1" });

      await service.update("m1", { quarter3Home: 5 });
      expect(mockPrismaService.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ homeScore: 25 }),
        }),
      );
    });
  });

  describe("remove", () => {
    it("should remove match", async () => {
      mockPrismaService.match.findUnique.mockResolvedValue({ id: "m1" });
      await service.remove("m1");
      expect(mockPrismaService.match.delete).toHaveBeenCalledWith({
        where: { id: "m1" },
      });
    });
  });
});
