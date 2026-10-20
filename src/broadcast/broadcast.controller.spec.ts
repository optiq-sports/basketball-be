import { Test, TestingModule } from "@nestjs/testing";
import { BroadcastController } from "./broadcast.controller";
import { BroadcastService } from "./broadcast.service";
import type { AppRequest } from "../common/interfaces/app.interface";
import { Role } from "@prisma/client";

describe("BroadcastController", () => {
  let controller: BroadcastController;
  let service: BroadcastService;

  const mockBroadcastService = {
    resolveSlug: jest.fn(),
    getBroadcastClientBySlug: jest.fn(),
    getBroadcastMatches: jest.fn(),
    getOverlayState: jest.fn(),
    updateOverlayState: jest.fn(),
    createOverlayLink: jest.fn(),
    revokeOverlayLink: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BroadcastController],
      providers: [
        {
          provide: BroadcastService,
          useValue: mockBroadcastService,
        },
      ],
    }).compile();

    controller = module.get<BroadcastController>(BroadcastController);
    service = module.get<BroadcastService>(BroadcastService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("Overlay Endpoints", () => {
    const mockUser = {
      id: "usr_b1",
      email: "broadcaster@test.com",
      role: Role.BROADCASTER,
    };
    const mockReq = { user: mockUser } as unknown as AppRequest;

    it("getOverlay should call service.getOverlayState", async () => {
      const mockState = {
        activeScene: "quarter_scores",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1 },
        updatedAt: new Date(),
      };
      mockBroadcastService.getOverlayState.mockResolvedValue(mockState);

      const result = await controller.getOverlay(
        "match_1",
        undefined,
        mockUser,
      );
      expect(result).toEqual(mockState);
      expect(mockBroadcastService.getOverlayState).toHaveBeenCalledWith(
        mockUser,
        "match_1",
        undefined,
      );
    });

    it("updateOverlay should call service.updateOverlayState", async () => {
      const mockDto = {
        activeScene: "player_spotlight" as const,
        payload: { v: 1, player: "LeBron" },
        visible: true,
      };
      const mockState = {
        ...mockDto,
        scorebugVisible: true,
        autoDismissAt: null,
        updatedAt: new Date(),
      };
      mockBroadcastService.updateOverlayState.mockResolvedValue(mockState);

      const result = await controller.updateOverlay(
        "match_1",
        mockDto,
        mockUser,
      );
      expect(result).toEqual(mockState);
      expect(mockBroadcastService.updateOverlayState).toHaveBeenCalledWith(
        mockUser,
        "match_1",
        mockDto,
      );
    });

    it("createOverlayLink should call service.createOverlayLink", async () => {
      const mockDto = { expiresInHours: 48 };
      const mockLink = {
        token: "ovl_test123",
        tokenPrefix: "ovl_test...",
        expiresAt: new Date(),
        outputUrl: "https://broadcast.optiqsports.com/overlay/ovl_test123",
      };
      mockBroadcastService.createOverlayLink.mockResolvedValue(mockLink);

      const result = await controller.createOverlayLink(
        "match_1",
        mockDto,
        mockUser,
      );
      expect(result).toEqual(mockLink);
      expect(mockBroadcastService.createOverlayLink).toHaveBeenCalledWith(
        mockUser,
        "match_1",
        mockDto,
      );
    });

    it("revokeOverlayLink should call service.revokeOverlayLink", async () => {
      const mockRes = {
        success: true,
        message: "Overlay link revoked successfully",
      };
      mockBroadcastService.revokeOverlayLink.mockResolvedValue(mockRes);

      const result = await controller.revokeOverlayLink(
        "match_1",
        "usr_b1",
        mockUser,
      );
      expect(result).toEqual(mockRes);
      expect(mockBroadcastService.revokeOverlayLink).toHaveBeenCalledWith(
        mockUser,
        "match_1",
        "usr_b1",
      );
    });
  });

  describe("getClientBySlug", () => {
    it("should resolve slug and return broadcast client", async () => {
      const mockClient = {
        id: "client_1",
        name: "OneSport TV",
        slug: "onesporttv",
        clientType: "broadcast",
      };
      mockBroadcastService.resolveSlug.mockReturnValue("onesporttv");
      mockBroadcastService.getBroadcastClientBySlug.mockResolvedValue(
        mockClient,
      );

      const result = await controller.getClientBySlug("onesporttv", undefined);
      expect(result).toEqual(mockClient);
      expect(mockBroadcastService.resolveSlug).toHaveBeenCalledWith(
        "onesporttv",
        undefined,
      );
      expect(
        mockBroadcastService.getBroadcastClientBySlug,
      ).toHaveBeenCalledWith("onesporttv");
    });
  });

  describe("getMatchesBySlug", () => {
    it("should resolve slug and return broadcast matches", async () => {
      const mockResult = {
        client: {
          id: "client_1",
          name: "OneSport TV",
          slug: "onesporttv",
          clientType: "broadcast",
        },
        matches: [],
      };
      mockBroadcastService.resolveSlug.mockReturnValue("onesporttv");
      mockBroadcastService.getBroadcastMatches.mockResolvedValue(mockResult);

      const mockReq = { user: undefined } as unknown as AppRequest;
      const result = await controller.getMatchesBySlug(
        "onesporttv",
        undefined,
        mockReq,
      );
      expect(result).toEqual(mockResult as any);
      expect(mockBroadcastService.resolveSlug).toHaveBeenCalledWith(
        "onesporttv",
        undefined,
      );
      expect(mockBroadcastService.getBroadcastMatches).toHaveBeenCalledWith(
        "onesporttv",
        undefined,
      );
    });
  });

  describe("getClientByHost", () => {
    it("should resolve slug from host and return broadcast client", async () => {
      const mockClient = {
        id: "client_1",
        name: "OneSport TV",
        slug: "onesporttv",
        clientType: "broadcast",
      };
      mockBroadcastService.resolveSlug.mockReturnValue("onesporttv");
      mockBroadcastService.getBroadcastClientBySlug.mockResolvedValue(
        mockClient,
      );

      const result = await controller.getClientByHost(
        "onesporttv.optiqsports.com",
      );
      expect(result).toEqual(mockClient);
      expect(mockBroadcastService.resolveSlug).toHaveBeenCalledWith(
        undefined,
        "onesporttv.optiqsports.com",
      );
      expect(
        mockBroadcastService.getBroadcastClientBySlug,
      ).toHaveBeenCalledWith("onesporttv");
    });
  });

  describe("getMatchesByHost", () => {
    it("should resolve slug from host and return broadcast matches", async () => {
      const mockResult = {
        client: {
          id: "client_1",
          name: "OneSport TV",
          slug: "onesporttv",
          clientType: "broadcast",
        },
        matches: [],
      };
      mockBroadcastService.resolveSlug.mockReturnValue("onesporttv");
      mockBroadcastService.getBroadcastMatches.mockResolvedValue(mockResult);

      const mockReq = { user: undefined } as unknown as AppRequest;
      const result = await controller.getMatchesByHost(
        "onesporttv.optiqsports.com",
        mockReq,
      );
      expect(result).toEqual(mockResult as any);
      expect(mockBroadcastService.resolveSlug).toHaveBeenCalledWith(
        undefined,
        "onesporttv.optiqsports.com",
      );
      expect(mockBroadcastService.getBroadcastMatches).toHaveBeenCalledWith(
        "onesporttv",
        undefined,
      );
    });
  });
});
