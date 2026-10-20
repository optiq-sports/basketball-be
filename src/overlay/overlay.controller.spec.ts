import { Test, TestingModule } from "@nestjs/testing";
import { OverlayController } from "./overlay.controller";
import { OverlayService } from "./overlay.service";
import { of } from "rxjs";
import { firstValueFrom } from "rxjs";

describe("OverlayController", () => {
  let controller: OverlayController;
  let service: OverlayService;

  const mockOverlayService = {
    getSceneByToken: jest.fn(),
    getStream: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OverlayController],
      providers: [
        {
          provide: OverlayService,
          useValue: mockOverlayService,
        },
      ],
    }).compile();

    controller = module.get<OverlayController>(OverlayController);
    service = module.get<OverlayService>(OverlayService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getScene", () => {
    it("should return scene state by token", async () => {
      const mockResult = {
        activeScene: "last_play",
        visible: true,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1 },
        updatedAt: new Date(),
      };
      mockOverlayService.getSceneByToken.mockResolvedValue(mockResult);

      const result = await controller.getScene("token_123");
      expect(result).toBe(mockResult);
      expect(mockOverlayService.getSceneByToken).toHaveBeenCalledWith(
        "token_123",
      );
    });
  });

  describe("streamOverlay", () => {
    it("should return stream Observable", async () => {
      const mockEvent = { type: "overlay", data: { activeScene: "blank" } };
      mockOverlayService.getStream.mockResolvedValue(of(mockEvent));

      const stream$ = controller.streamOverlay("token_123");
      const event = await firstValueFrom(stream$);

      expect(event).toEqual(mockEvent);
      expect(mockOverlayService.getStream).toHaveBeenCalledWith("token_123");
    });
  });
});
