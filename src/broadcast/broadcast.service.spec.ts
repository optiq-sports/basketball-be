import { Test, TestingModule } from "@nestjs/testing";
import { BroadcastService } from "./broadcast.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Role } from "@prisma/client";

describe("BroadcastService", () => {
  let service: BroadcastService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              findFirst: jest.fn(),
            },
            match: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BroadcastService>(BroadcastService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe("resolveSlug", () => {
    it("should return the slug when provided directly", () => {
      expect(service.resolveSlug("onesporttv")).toBe("onesporttv");
      expect(service.resolveSlug("OneSportTV ")).toBe("onesporttv");
    });

    it("should resolve slug from host header when subdomain is present", () => {
      expect(service.resolveSlug(undefined, "onesporttv.optiqsports.com")).toBe(
        "onesporttv",
      );
      expect(service.resolveSlug(undefined, "sportsone.localhost:3000")).toBe(
        "sportsone",
      );
    });

    it("should throw BadRequestException if subdomain is reserved or localhost", () => {
      expect(() =>
        service.resolveSlug(undefined, "api.optiqsports.com"),
      ).toThrow(BadRequestException);
      expect(() =>
        service.resolveSlug(undefined, "www.optiqsports.com"),
      ).toThrow(BadRequestException);
      expect(() => service.resolveSlug(undefined, "localhost:3000")).toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if slug is 'matches' without host subdomain", () => {
      expect(() => service.resolveSlug("matches", undefined)).toThrow(
        BadRequestException,
      );
    });
  });

  describe("getBroadcastClientBySlug", () => {
    it("should return broadcast client details", async () => {
      const mockClient = {
        id: "client_1",
        name: "OneSport TV",
        slug: "onesporttv",
        clientType: "broadcast",
        websiteUrl: "https://onesport.tv",
        logo: "https://onesport.tv/logo.png",
      };
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.getBroadcastClientBySlug("onesporttv");
      expect(result).toEqual(mockClient);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          slug: "onesporttv",
          clientType: "broadcast",
        },
        select: expect.any(Object),
      });
    });

    it("should throw NotFoundException if client not found", async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getBroadcastClientBySlug("nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getBroadcastMatches", () => {
    it("should return games assigned to the broadcast client", async () => {
      const mockClient = {
        id: "client_1",
        name: "OneSport TV",
        slug: "onesporttv",
        clientType: "broadcast",
        websiteUrl: "https://onesport.tv",
        logo: null,
      };
      const mockMatches = [
        {
          id: "match_1",
          clientId: "client_1",
          homeTeam: { id: "team_1", name: "Lakers" },
          awayTeam: { id: "team_2", name: "Celtics" },
          scheduledDate: new Date(),
        },
      ];

      (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);
      (prisma.match.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const result = await service.getBroadcastMatches("onesporttv");
      expect(result.client).toEqual(mockClient);
      expect(result.matches).toEqual(mockMatches as any);
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: { clientId: "client_1" },
        include: expect.any(Object),
        orderBy: { scheduledDate: "asc" },
      });
    });

    it("should return empty matches if authenticated CLIENT user does not match the broadcast client", async () => {
      const mockClient = {
        id: "client_1",
        name: "OneSport TV",
        slug: "onesporttv",
        clientType: "broadcast",
        websiteUrl: null,
        logo: null,
      };
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);

      const otherUser = {
        id: "user_other",
        email: "other@operator.com",
        role: Role.CLIENT,
        clientIds: ["client_other"],
      };

      const result = await service.getBroadcastMatches("onesporttv", otherUser);
      expect(result.client).toEqual(mockClient);
      expect(result.matches).toEqual([]);
      expect(prisma.match.findMany).not.toHaveBeenCalled();
    });
  });
});
