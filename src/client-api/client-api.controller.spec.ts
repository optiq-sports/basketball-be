import { Test, TestingModule } from "@nestjs/testing";
import { ClientApiController } from "./client-api.controller";
import { ClientApiService } from "./client-api.service";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { of } from "rxjs";

describe("ClientApiController", () => {
  let controller: ClientApiController;
  let service: ClientApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientApiController],
      providers: [
        {
          provide: ClientApiService,
          useValue: {
            getMatches: jest.fn(),
            getMatchDetails: jest.fn(),
            getBoxScore: jest.fn(),
            getShotChart: jest.fn(),
            streamMatch: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ClientApiController>(ClientApiController);
    service = module.get<ClientApiService>(ClientApiService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  const mockRequest: any = {
    user: {
      clientIds: ["client_id_1"],
      role: "EXTERNAL_CLIENT",
    },
  };

  it("should get matches for client", async () => {
    const expectedResult = [{ id: "match1" }];
    (service.getMatches as jest.Mock).mockResolvedValue(expectedResult);

    const result = await controller.getMatches(mockRequest);
    expect(result).toBe(expectedResult);
    expect(service.getMatches).toHaveBeenCalledWith("client_id_1");
  });

  it("should stream match events", (done) => {
    const mockStreamEvent = { data: "test" };
    const mockPromise = Promise.resolve(of(mockStreamEvent as any));
    (service.streamMatch as jest.Mock).mockReturnValue(mockPromise);

    const observable = controller.streamMatch(mockRequest, "match_1", {
      sinceVersion: "10",
    });

    observable.subscribe((val) => {
      expect(val).toBe(mockStreamEvent);
      expect(service.streamMatch).toHaveBeenCalledWith(
        "client_id_1",
        "match_1",
        10,
      );
      done();
    });
  });
});
