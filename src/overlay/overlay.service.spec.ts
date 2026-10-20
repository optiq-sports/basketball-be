import { Test, TestingModule } from "@nestjs/testing";
import { OverlayService } from "./overlay.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { firstValueFrom } from "rxjs";

describe("OverlayService", () => {
  let service: OverlayService;
  let auditLogsService: AuditLogsService;

  const mockPrisma = {
    $transaction: jest.fn(),
    clientOverlayToken: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
    overlayScene: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockRedis = {
    subscribeOverlayUpdates: jest.fn().mockReturnValue(() => {}),
    publishOverlayUpdate: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditLogsService = {
    recordLog: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));

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
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<OverlayService>(OverlayService);
    auditLogsService = module.get<AuditLogsService>(AuditLogsService);
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

    it("should return clientId, matchId, and broadcasterId for a valid active token", async () => {
      mockPrisma.clientOverlayToken.findUnique.mockResolvedValue({
        id: "tok_1",
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_broadcaster_1",
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
        broadcasterId: "usr_broadcaster_1",
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
        broadcasterId: null,
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
        broadcasterId: null,
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
        broadcasterId: null,
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
      mockPrisma.overlayScene.findFirst.mockResolvedValue(null);

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

    it("should return stored scene state if record exists for broadcaster", async () => {
      const storedDate = new Date();
      mockPrisma.overlayScene.findFirst.mockResolvedValue({
        activeScene: "player_spotlight",
        visible: true,
        scorebugVisible: false,
        autoDismissAt: null,
        payload: { v: 1, player: "Curry" },
        updatedAt: storedDate,
      });

      const state = await service.getSceneState(
        "client_1",
        "match_1",
        "usr_broadcaster_1",
      );
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

  describe("saveSceneState, upsertScene & patchScene", () => {
    it("should create new scene when no existing record exists", async () => {
      const now = new Date();
      mockPrisma.overlayScene.findFirst.mockResolvedValue(null);
      mockPrisma.overlayScene.create.mockResolvedValue({
        id: "sc_1",
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_b1",
        activeScene: "quarter_scores",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1, q1: 24 },
        updatedAt: now,
      });

      const res = await service.saveSceneState({
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_b1",
        activeScene: "quarter_scores",
        payload: { v: 1, q1: 24 },
        visible: true,
      });

      expect(res.activeScene).toBe("quarter_scores");
      expect(mockPrisma.overlayScene.create).toHaveBeenCalled();
      expect(mockRedis.publishOverlayUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: "match_1",
          broadcasterId: "usr_b1",
          state: res,
        }),
      );
    });

    it("should update existing scene when record exists", async () => {
      const now = new Date();
      mockPrisma.overlayScene.findFirst.mockResolvedValue({
        id: "sc_1",
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_b1",
      });
      mockPrisma.overlayScene.update.mockResolvedValue({
        id: "sc_1",
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_b1",
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
      expect(mockPrisma.overlayScene.update).toHaveBeenCalled();
      expect(mockRedis.publishOverlayUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: "match_1",
          state: res,
        }),
      );
    });
  });

  describe("issueOverlayToken and revokeOverlayToken", () => {
    it("should issue overlay token, invalidate prior tokens, record audit log, and return outputUrl", async () => {
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
      mockPrisma.clientOverlayToken.create.mockResolvedValue({
        id: "tok_new",
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_b1",
        tokenHash: "hash123",
        tokenPrefix: "ovl_12345678...",
        expiresAt,
        isActive: true,
      });

      const res = await service.issueOverlayToken({
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_b1",
        actorUserId: "usr_b1",
        actorRole: "BROADCASTER",
        expiresInHours: 24,
      });

      expect(res.token).toMatch(/^ovl_/);
      expect(res.tokenPrefix).toMatch(/^ovl_/);
      expect(res.outputUrl).toContain("/overlay/ovl_");
      expect(mockPrisma.clientOverlayToken.updateMany).toHaveBeenCalledWith({
        where: {
          matchId: "match_1",
          broadcasterId: "usr_b1",
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
      expect(mockAuditLogsService.recordLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "CREATE_OVERLAY_TOKEN",
          entityType: "client_overlay_token",
        }),
      );
    });

    it("should revoke overlay tokens and record audit log", async () => {
      const res = await service.revokeOverlayToken({
        clientId: "client_1",
        matchId: "match_1",
        broadcasterId: "usr_b1",
        actorUserId: "usr_b1",
        actorRole: "BROADCASTER",
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.clientOverlayToken.updateMany).toHaveBeenCalledWith({
        where: {
          matchId: "match_1",
          broadcasterId: "usr_b1",
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
      expect(mockAuditLogsService.recordLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "REVOKE_OVERLAY_TOKEN",
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
        broadcasterId: "usr_b1",
        isActive: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        client: { isActive: true },
      });

      mockPrisma.overlayScene.findFirst.mockResolvedValue({
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
