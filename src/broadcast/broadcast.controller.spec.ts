import { Test, TestingModule } from "@nestjs/testing";
import { BroadcastController } from "./broadcast.controller";
import { BroadcastService } from "./broadcast.service";
import type { AppRequest } from "../common/interfaces/app.interface";

describe("BroadcastController", () => {
  let controller: BroadcastController;
  let service: BroadcastService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BroadcastController],
      providers: [
        {
          provide: BroadcastService,
          useValue: {
            resolveSlug: jest.fn(),
            getBroadcastClientBySlug: jest.fn(),
            getBroadcastMatches: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BroadcastController>(BroadcastController);
    service = module.get<BroadcastService>(BroadcastService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getClientBySlug", () => {
    it("should resolve slug and return broadcast client", async () => {
      const mockClient = {
        id: "client_1",
        name: "OneSport TV",
        slug: "onesporttv",
        clientType: "broadcast",
      };
      (service.resolveSlug as jest.Mock).mockReturnValue("onesporttv");
      (service.getBroadcastClientBySlug as jest.Mock).mockResolvedValue(
        mockClient,
      );

      const result = await controller.getClientBySlug("onesporttv", undefined);
      expect(result).toEqual(mockClient);
      expect(service.resolveSlug).toHaveBeenCalledWith("onesporttv", undefined);
      expect(service.getBroadcastClientBySlug).toHaveBeenCalledWith(
        "onesporttv",
      );
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
      (service.resolveSlug as jest.Mock).mockReturnValue("onesporttv");
      (service.getBroadcastMatches as jest.Mock).mockResolvedValue(mockResult);

      const mockReq = { user: undefined } as unknown as AppRequest;
      const result = await controller.getMatchesBySlug(
        "onesporttv",
        undefined,
        mockReq,
      );
      expect(result).toEqual(mockResult as any);
      expect(service.resolveSlug).toHaveBeenCalledWith("onesporttv", undefined);
      expect(service.getBroadcastMatches).toHaveBeenCalledWith(
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
      (service.resolveSlug as jest.Mock).mockReturnValue("onesporttv");
      (service.getBroadcastClientBySlug as jest.Mock).mockResolvedValue(
        mockClient,
      );

      const result = await controller.getClientByHost(
        "onesporttv.optiqsports.com",
      );
      expect(result).toEqual(mockClient);
      expect(service.resolveSlug).toHaveBeenCalledWith(
        undefined,
        "onesporttv.optiqsports.com",
      );
      expect(service.getBroadcastClientBySlug).toHaveBeenCalledWith(
        "onesporttv",
      );
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
      (service.resolveSlug as jest.Mock).mockReturnValue("onesporttv");
      (service.getBroadcastMatches as jest.Mock).mockResolvedValue(mockResult);

      const mockReq = { user: undefined } as unknown as AppRequest;
      const result = await controller.getMatchesByHost(
        "onesporttv.optiqsports.com",
        mockReq,
      );
      expect(result).toEqual(mockResult as any);
      expect(service.resolveSlug).toHaveBeenCalledWith(
        undefined,
        "onesporttv.optiqsports.com",
      );
      expect(service.getBroadcastMatches).toHaveBeenCalledWith(
        "onesporttv",
        undefined,
      );
    });
  });
});
