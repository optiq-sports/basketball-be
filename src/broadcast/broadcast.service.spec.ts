import { Test, TestingModule } from "@nestjs/testing";
import { BroadcastService } from "./broadcast.service";
import { PrismaService } from "../prisma/prisma.service";
import { OverlayService } from "../overlay/overlay.service";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthenticatedUser } from "../common/interfaces/user.interface";

describe("BroadcastService", () => {
  let service: BroadcastService;
  let prisma: PrismaService;
  let overlayService: OverlayService;

  const mockPrisma = {
    client: {
      findFirst: jest.fn(),
    },
    match: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockOverlayService = {
    getSceneState: jest.fn(),
    saveSceneState: jest.fn(),
    issueOverlayToken: jest.fn(),
    revokeOverlayToken: jest.fn(),
    getActiveOverlayLink: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: OverlayService,
          useValue: mockOverlayService,
        },
      ],
    }).compile();

    service = module.get<BroadcastService>(BroadcastService);
    prisma = module.get<PrismaService>(PrismaService);
    overlayService = module.get<OverlayService>(OverlayService);
  });

  describe("checkBroadcastMatchAccess", () => {
    const mockMatch = {
      id: "match_1",
      clientId: "client_1",
      broadcasters: [{ userId: "broadcaster_1" }],
    };

    it("should reject CLIENT role with ForbiddenException", async () => {
      const clientUser: AuthenticatedUser = {
        id: "usr_client",
        email: "client@test.com",
        role: Role.CLIENT,
        clientIds: ["client_1"],
      };

      await expect(
        service.checkBroadcastMatchAccess(clientUser, "match_1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should reject if match does not exist with NotFoundException", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);
      const broadcasterUser: AuthenticatedUser = {
        id: "broadcaster_1",
        email: "b@test.com",
        role: Role.BROADCASTER,
      };

      await expect(
        service.checkBroadcastMatchAccess(broadcasterUser, "match_nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should reject unassigned BROADCASTER with NotFoundException (404 per handoff)", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const otherBroadcaster: AuthenticatedUser = {
        id: "broadcaster_other",
        email: "other@test.com",
        role: Role.BROADCASTER,
      };

      await expect(
        service.checkBroadcastMatchAccess(otherBroadcaster, "match_1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should allow assigned BROADCASTER and resolve their userId", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const assignedBroadcaster: AuthenticatedUser = {
        id: "broadcaster_1",
        email: "b1@test.com",
        role: Role.BROADCASTER,
      };

      const res = await service.checkBroadcastMatchAccess(
        assignedBroadcaster,
        "match_1",
      );
      expect(res.resolvedBroadcasterId).toBe("broadcaster_1");
    });

    it("should reject ADMIN if match clientId is not in their clientIds", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const foreignAdmin: AuthenticatedUser = {
        id: "admin_other",
        email: "admin@other.com",
        role: Role.ADMIN,
        clientIds: ["client_other"],
      };

      await expect(
        service.checkBroadcastMatchAccess(foreignAdmin, "match_1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow ADMIN if match belongs to their client and resolve broadcaster", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const matchAdmin: AuthenticatedUser = {
        id: "admin_1",
        email: "admin@client1.com",
        role: Role.ADMIN,
        clientIds: ["client_1"],
      };

      const res = await service.checkBroadcastMatchAccess(
        matchAdmin,
        "match_1",
      );
      expect(res.resolvedBroadcasterId).toBe("broadcaster_1");
    });

    it("should reject if match has no assigned broadcasters when accessed by ADMIN", async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: "match_1",
        clientId: "client_1",
        broadcasters: [],
      });
      const matchAdmin: AuthenticatedUser = {
        id: "admin_1",
        email: "admin@client1.com",
        role: Role.ADMIN,
        clientIds: ["client_1"],
      };

      await expect(
        service.checkBroadcastMatchAccess(matchAdmin, "match_1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject admin specifying a broadcaster not assigned to match", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const matchAdmin: AuthenticatedUser = {
        id: "admin_1",
        email: "admin@client1.com",
        role: Role.ADMIN,
        clientIds: ["client_1"],
      };

      await expect(
        service.checkBroadcastMatchAccess(
          matchAdmin,
          "match_1",
          "unassigned_broadcaster",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow SUPER_ADMIN on any match when broadcaster is assigned", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const superAdmin: AuthenticatedUser = {
        id: "super_admin_1",
        email: "super@optiq.com",
        role: Role.SUPER_ADMIN,
      };

      const res = await service.checkBroadcastMatchAccess(
        superAdmin,
        "match_1",
        "broadcaster_1",
      );
      expect(res.resolvedBroadcasterId).toBe("broadcaster_1");
    });
  });

  describe("Overlay State & Link Endpoints", () => {
    const mockMatch = {
      id: "match_1",
      clientId: "client_1",
      broadcasters: [{ userId: "broadcaster_1" }],
    };

    const assignedBroadcaster: AuthenticatedUser = {
      id: "broadcaster_1",
      email: "b1@test.com",
      role: Role.BROADCASTER,
    };

    it("should fetch overlay state for assigned match", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const mockState = {
        activeScene: "quarter_scores",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1 },
        updatedAt: new Date(),
      };
      mockOverlayService.getSceneState.mockResolvedValue(mockState);

      const res = await service.getOverlayState(assignedBroadcaster, "match_1");
      expect(res).toEqual(mockState);
      expect(mockOverlayService.getSceneState).toHaveBeenCalledWith(
        "client_1",
        "match_1",
        "broadcaster_1",
      );
    });

    it("should update overlay state for assigned match", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const updatedState = {
        activeScene: "player_spotlight",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1, player: "LeBron" },
        updatedAt: new Date(),
      };
      mockOverlayService.saveSceneState.mockResolvedValue(updatedState);

      const res = await service.updateOverlayState(
        assignedBroadcaster,
        "match_1",
        {
          activeScene: "player_spotlight",
          payload: { v: 1, player: "LeBron" },
          visible: true,
        },
      );
      expect(res).toEqual(updatedState);
      expect(mockOverlayService.saveSceneState).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client_1",
          matchId: "match_1",
          broadcasterId: "broadcaster_1",
          activeScene: "player_spotlight",
        }),
      );
    });

    it("should get active overlay link", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const linkInfo = {
        tokenPrefix: "ovl_abc12345...",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      };
      mockOverlayService.getActiveOverlayLink.mockResolvedValue(linkInfo);

      const res = await service.getOverlayLink(assignedBroadcaster, "match_1");
      expect(res).toEqual(linkInfo);
      expect(mockOverlayService.getActiveOverlayLink).toHaveBeenCalledWith(
        "client_1",
        "match_1",
        "broadcaster_1",
      );
    });

    it("should create overlay link and return outputUrl", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      const linkResponse = {
        token: "ovl_abc123",
        tokenPrefix: "ovl_abc12345...",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        outputUrl: "https://broadcast.optiqsports.com/overlay/ovl_abc123",
      };
      mockOverlayService.issueOverlayToken.mockResolvedValue(linkResponse);

      const res = await service.createOverlayLink(
        assignedBroadcaster,
        "match_1",
        { expiresInHours: 24 },
      );
      expect(res).toEqual(linkResponse);
      expect(mockOverlayService.issueOverlayToken).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client_1",
          matchId: "match_1",
          broadcasterId: "broadcaster_1",
          actorUserId: "broadcaster_1",
          actorRole: "BROADCASTER",
          expiresInHours: 24,
        }),
      );
    });

    it("should revoke overlay link", async () => {
      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      mockOverlayService.revokeOverlayToken.mockResolvedValue({
        success: true,
        message: "Overlay link revoked successfully",
      });

      const res = await service.revokeOverlayLink(
        assignedBroadcaster,
        "match_1",
      );
      expect(res.success).toBe(true);
      expect(mockOverlayService.revokeOverlayToken).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client_1",
          matchId: "match_1",
          broadcasterId: "broadcaster_1",
          actorUserId: "broadcaster_1",
          actorRole: "BROADCASTER",
        }),
      );
    });
  });
});
