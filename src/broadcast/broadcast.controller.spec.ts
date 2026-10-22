import { Test, TestingModule } from "@nestjs/testing";
import { BroadcastController } from "./broadcast.controller";
import { BroadcastService } from "./broadcast.service";
import { Role } from "@prisma/client";

describe("BroadcastController", () => {
  let controller: BroadcastController;
  let service: BroadcastService;

  const mockBroadcastService = {
    getOverlayState: jest.fn(),
    updateOverlayState: jest.fn(),
    getOverlayLink: jest.fn(),
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

    it("getOverlayLink should call service.getOverlayLink", async () => {
      const mockLink = {
        tokenPrefix: "ovl_test...",
        expiresAt: new Date(),
      };
      mockBroadcastService.getOverlayLink.mockResolvedValue(mockLink);

      const result = await controller.getOverlayLink(
        "match_1",
        undefined,
        mockUser,
      );
      expect(result).toEqual(mockLink);
      expect(mockBroadcastService.getOverlayLink).toHaveBeenCalledWith(
        mockUser,
        "match_1",
        undefined,
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
});
