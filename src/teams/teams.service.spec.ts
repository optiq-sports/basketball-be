import { Test, TestingModule } from "@nestjs/testing";
import { TeamsService } from "./teams.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictException, NotFoundException } from "@nestjs/common";

describe("TeamsService", () => {
  let service: TeamsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    team: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    playerTeam: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should throw ConflictException if team code already exists", async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: "t1",
        code: "TEST",
      });
      await expect(
        service.create({ name: "Test Team", code: "TEST" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should create a new team successfully", async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);
      const team = { id: "t1", name: "Test Team", code: "TEST" };
      mockPrismaService.team.create.mockResolvedValue(team);

      const result = await service.create({ name: "Test Team", code: "TEST" });
      expect(result).toEqual(team);
      expect(mockPrismaService.team.create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return all teams", async () => {
      mockPrismaService.team.findMany.mockResolvedValue([{ id: "t1" }]);
      const result = await service.findAll();
      expect(result).toEqual([{ id: "t1" }]);
    });
  });

  describe("findOne", () => {
    it("should throw NotFoundException if team is not found", async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);
      await expect(service.findOne("invalid")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return team if found", async () => {
      const team = { id: "t1" };
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      const result = await service.findOne("t1");
      expect(result).toEqual(team);
    });
  });

  describe("update", () => {
    it("should throw ConflictException if updating to an existing code", async () => {
      const team = { id: "t1", code: "OLD" };
      mockPrismaService.team.findUnique
        .mockResolvedValueOnce(team) // findOne
        .mockResolvedValueOnce({ id: "t2", code: "NEW" }); // conflict check

      await expect(service.update("t1", { code: "NEW" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("should update the team successfully", async () => {
      const team = { id: "t1", code: "OLD" };
      mockPrismaService.team.findUnique
        .mockResolvedValueOnce(team)
        .mockResolvedValueOnce(null);
      mockPrismaService.team.update.mockResolvedValue({
        id: "t1",
        code: "NEW",
      });

      const result = await service.update("t1", { code: "NEW" });
      expect(result.code).toEqual("NEW");
    });
  });

  describe("remove", () => {
    it("should remove the team", async () => {
      const team = { id: "t1", name: "Team", code: "TM" };
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.team.delete.mockResolvedValue(team);

      await service.remove("t1");
      expect(mockPrismaService.team.delete).toHaveBeenCalledWith({
        where: { id: "t1" },
      });
    });
  });

  describe("setCaptain", () => {
    it("should throw NotFoundException if player not found in team", async () => {
      mockPrismaService.playerTeam.findFirst.mockResolvedValue(null);
      await expect(
        service.setCaptain("team1", "player1", true),
      ).rejects.toThrow(NotFoundException);
    });

    it("should clear other captains and set the new captain", async () => {
      mockPrismaService.playerTeam.findFirst.mockResolvedValue({ id: "pt1" });
      const team = { id: "team1" };
      mockPrismaService.team.findUnique.mockResolvedValue(team);

      const result = await service.setCaptain("team1", "player1", true);

      expect(mockPrismaService.playerTeam.updateMany).toHaveBeenCalledWith({
        where: { teamId: "team1", isActive: true },
        data: { isCaptain: false },
      });
      expect(mockPrismaService.playerTeam.update).toHaveBeenCalledWith({
        where: { id: "pt1" },
        data: { isCaptain: true },
      });
      expect(result).toEqual(team);
    });
  });
});
