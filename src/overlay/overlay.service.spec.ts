import { Test, TestingModule } from "@nestjs/testing";
import { OverlayService } from "./overlay.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { firstValueFrom, take, toArray } from "rxjs";

describe("OverlayService", () => {
  let service: OverlayService;
  let prisma: PrismaService;
  let redisService: RedisService;

  const mockPrisma = {
    clientOverlayToken: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    overlayScene: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockRedis = {
    subscribeOverlayUpdates: jest.fn().mockReturnValue(() => {}),
    publishOverlayUpdate: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverlayService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: RedisService,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<OverlayService>(OverlayService);
    prisma = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe("validatePayload", () => {
    it("should accept valid payload with v: 1 under 32 KB", () => {
      expect(() =>
        service.validatePayload({ v: 1, text: "Sample" }),
      ).not.toThrow();
    });

    it("should reject payload if not an object or null", () => {
      expect(() => service.validatePayload(null)).toThrow(BadRequestException);
      expect(() => service.validatePayload([1, 2, 3])).toThrow(
        BadRequestException,
      );
      expect(() => service.validatePayload("not an object")).toThrow(
        BadRequestException,
      );
    });

    it("should reject payload without v === 1", () => {
      expect(() => service.validatePayload({ v: 2 })).toThrow(
        BadRequestException,
      );
      expect(() => service.validatePayload({ title: "No version" })).toThrow(
        BadRequestException,
      );
    });

    it("should reject payload larger than 32 KB", () => {
      const hugeString = "x".repeat(33 * 1024);
      expect(() => service.validatePayload({ v: 1, data: hugeString })).toThrow(
        BadRequestException,
      );
    });
  });

  describe("validateScene", () => {
    it("should accept valid scenes", () => {
      expect(() => service.validateScene("player_spotlight")).not.toThrow();
      expect(() => service.validateScene("blank")).not.toThrow();
      expect(() => service.validateScene("team_comparison")).not.toThrow();
      expect(() => service.validateScene("quarter_scores")).not.toThrow();
      expect(() => service.validateScene("scoring_run")).not.toThrow();
      expect(() => service.validateScene("last_play")).not.toThrow();
      expect(() => service.validateScene("game_leaders")).not.toThrow();
      expect(() => service.validateScene("zone_shooting")).not.toThrow();
      expect(() => service.validateScene("starting_lineups")).not.toThrow();
    });

    it("should reject invalid scenes", () => {
      expect(() => service.validateScene("non_existent_scene")).toThrow(
        BadRequestException,
      );
    });
  });

  describe("validateOverlayToken", () => {
    const rawToken = "ovl_raw_test_token";
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    it("should return clientId and matchId for a valid active token", async () => {
      mockPrisma.clientOverlayToken.findUnique.mockResolvedValue({
        id: "tok_1",
        clientId: "client_1",
        matchId: "match_1",
        tokenHash,
        isActive: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        client: { isActive: true },
      });

      const res = await service.validateOverlayToken(rawToken);
      expect(res).toEqual({
        clientId: "client_1",
        matchId: "match_1",
      });
      expect(mockPrisma.clientOverlayToken.update).toHaveBeenCalledWith({
        where: { id: "tok_1" },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it("should throw NotFoundException if token does not exist", async () => {
      mockPrisma.clientOverlayToken.findUnique.mockResolvedValue(null);
      await expect(service.validateOverlayToken(rawToken)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw UnauthorizedException if token is revoked or inactive", async () => {
      mockPrisma.clientOverlayToken.findUnique.mockResolvedValue({
        id: "tok_1",
        clientId: "client_1",
        matchId: "match_1",
        isActive: false,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        client: { isActive: true },
      });

      await expect(service.validateOverlayToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw ForbiddenException if client is inactive", async () => {
      mockPrisma.clientOverlayToken.findUnique.mockResolvedValue({
        id: "tok_1",
        clientId: "client_1",
        matchId: "match_1",
        isActive: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        client: { isActive: false },
      });

      await expect(service.validateOverlayToken(rawToken)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw UnauthorizedException if token is expired", async () => {
      mockPrisma.clientOverlayToken.findUnique.mockResolvedValue({
        id: "tok_1",
        clientId: "client_1",
        matchId: "match_1",
        isActive: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // in the past
        client: { isActive: true },
      });

      await expect(service.validateOverlayToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("getSceneState", () => {
    it("should return default blank state if no record in database", async () => {
      mockPrisma.overlayScene.findUnique.mockResolvedValue(null);

      const state = await service.getSceneState("client_1", "match_1");
      expect(state).toEqual({
        activeScene: "blank",
        visible: false,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1 },
        updatedAt: expect.any(Date),
      });
    });

    it("should return stored scene state if record exists", async () => {
      const storedDate = new Date();
      mockPrisma.overlayScene.findUnique.mockResolvedValue({
        activeScene: "player_spotlight",
        visible: true,
        scorebugVisible: false,
        autoDismissAt: null,
        payload: { v: 1, player: "Curry" },
        updatedAt: storedDate,
      });

      const state = await service.getSceneState("client_1", "match_1");
      expect(state).toEqual({
        activeScene: "player_spotlight",
        visible: true,
        scorebugVisible: false,
        autoDismissAt: null,
        payload: { v: 1, player: "Curry" },
        updatedAt: storedDate,
      });
    });
  });

  describe("upsertScene & patchScene", () => {
    it("should upsert scene and broadcast update", async () => {
      const now = new Date();
      mockPrisma.overlayScene.upsert.mockResolvedValue({
        activeScene: "quarter_scores",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1, q1: 24 },
        updatedAt: now,
      });

      const res = await service.upsertScene("client_1", "user_1", {
        matchId: "match_1",
        activeScene: "quarter_scores",
        payload: { v: 1, q1: 24 },
        visible: true,
      });

      expect(res.activeScene).toBe("quarter_scores");
      expect(mockRedis.publishOverlayUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: "match_1",
          state: res,
        }),
      );
    });

    it("should patch scene and broadcast update", async () => {
      const now = new Date();
      mockPrisma.overlayScene.upsert.mockResolvedValue({
        activeScene: "team_comparison",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1 },
        updatedAt: now,
      });

      const res = await service.patchScene("client_1", "user_1", "match_1", {
        activeScene: "team_comparison",
        visible: true,
      });

      expect(res.activeScene).toBe("team_comparison");
      expect(mockRedis.publishOverlayUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: "match_1",
          state: res,
        }),
      );
    });
  });

  describe("resetScene", () => {
    it("should delete record and broadcast blank scene", async () => {
      mockPrisma.overlayScene.deleteMany.mockResolvedValue({ count: 1 });

      const res = await service.resetScene("client_1", "user_1", "match_1");
      expect(res.success).toBe(true);
      expect(mockPrisma.overlayScene.deleteMany).toHaveBeenCalledWith({
        where: { clientId: "client_1", matchId: "match_1" },
      });
      expect(mockRedis.publishOverlayUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: "match_1",
          state: expect.objectContaining({
            activeScene: "blank",
            visible: false,
          }),
        }),
      );
    });
  });

  describe("getStream", () => {
    const rawToken = "ovl_stream_test_token";

    it("should replay initial state on subscribe and forward live updates", async () => {
      mockPrisma.clientOverlayToken.findUnique.mockResolvedValue({
        id: "tok_1",
        clientId: "client_1",
        matchId: "match_1",
        isActive: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        client: { isActive: true },
      });

      mockPrisma.overlayScene.findUnique.mockResolvedValue({
        activeScene: "scoring_run",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1 },
        updatedAt: new Date(),
      });

      const stream$ = await service.getStream(rawToken, 100000);

      // Take initial event
      const initialEvent = await firstValueFrom(stream$);
      expect(initialEvent).toEqual({
        type: "overlay",
        data: expect.objectContaining({
          activeScene: "scoring_run",
          visible: true,
        }),
      });
    });
  });
});
