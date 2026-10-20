import { Test, TestingModule } from "@nestjs/testing";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";
import { Role } from "@prisma/client";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { CreateClientDto } from "./dto/create-client.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { AssignUserDto } from "./dto/assign-user.dto";
import { ClientFilterDto } from "./dto/client-filter.dto";

describe("ClientsController", () => {
  let controller: ClientsController;
  let service: ClientsService;

  const mockClientsService = {
    getMyClient: jest.fn(),
    listApiKeys: jest.fn(),
    createApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
    createClient: jest.fn(),
    listClients: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    assignUserToClient: jest.fn(),
    listClientUsers: jest.fn(),
    unlinkUserFromClient: jest.fn(),
    createEmbedToken: jest.fn(),
    listEmbedTokens: jest.fn(),
    revokeEmbedToken: jest.fn(),
    createOrReissueOverlayToken: jest.fn(),
    getActiveOverlayToken: jest.fn(),
    revokeOverlayToken: jest.fn(),
    getMyOverlays: jest.fn(),
    getMyOverlayByMatch: jest.fn(),
    upsertMyOverlay: jest.fn(),
    patchMyOverlay: jest.fn(),
    resetMyOverlay: jest.fn(),
  };

  const mockUser: AuthenticatedUser = {
    id: "user-1",
    email: "client@example.com",
    name: "Client User",
    role: Role.CLIENT,
    clientIds: ["client-1"],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
      ],
    }).compile();

    controller = module.get<ClientsController>(ClientsController);
    service = module.get<ClientsService>(ClientsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getMyClient", () => {
    it("should return current client organization", async () => {
      const mockResult = {
        id: "client-1",
        name: "Test Org",
        websiteUrl: "https://org.com",
        logo: null,
      };
      mockClientsService.getMyClient.mockResolvedValue(mockResult);

      const result = await controller.getMyClient(mockUser);
      expect(result).toEqual(mockResult);
      expect(service.getMyClient).toHaveBeenCalledWith(mockUser);
    });
  });

  describe("listClients", () => {
    it("should forward filter params including search to service", async () => {
      const query: ClientFilterDto = { search: "Test", page: 1, limit: 10 };
      const mockPaginated = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockClientsService.listClients.mockResolvedValue(mockPaginated);

      const result = await controller.listClients(query);
      expect(result).toEqual(mockPaginated);
      expect(service.listClients).toHaveBeenCalledWith(query);
    });
  });

  describe("listClientUsers", () => {
    it("should return users linked to client", async () => {
      const mockUsers = [
        {
          id: "u1",
          email: "u1@test.com",
          firstName: "A",
          lastName: "B",
          role: Role.CLIENT,
          createdAt: new Date(),
        },
      ];
      mockClientsService.listClientUsers.mockResolvedValue(mockUsers);

      const result = await controller.listClientUsers("client-1");
      expect(result).toEqual(mockUsers);
      expect(service.listClientUsers).toHaveBeenCalledWith("client-1");
    });
  });

  describe("unlinkUserFromClient", () => {
    it("should unlink user from client", async () => {
      const mockResponse = {
        message: "User unlinked from client successfully",
      };
      mockClientsService.unlinkUserFromClient.mockResolvedValue(mockResponse);

      const result = await controller.unlinkUserFromClient(
        mockUser,
        "client-1",
        "user-1",
      );
      expect(result).toEqual(mockResponse);
      expect(service.unlinkUserFromClient).toHaveBeenCalledWith(
        "client-1",
        "user-1",
        mockUser,
      );
    });
  });

  describe("Embed Tokens", () => {
    it("should create embed token for current client", async () => {
      const mockResult = {
        id: "emb-1",
        token: "emb_secret",
        name: "Main Site",
        allowedOrigins: ["https://example.com"],
      };
      mockClientsService.createEmbedToken.mockResolvedValue(mockResult);

      const result = await controller.createMyEmbedToken(mockUser, {
        name: "Main Site",
        allowedOrigins: ["https://example.com"],
      });

      expect(result).toEqual(mockResult);
      expect(service.createEmbedToken).toHaveBeenCalledWith(mockUser, {
        name: "Main Site",
        allowedOrigins: ["https://example.com"],
        clientId: "client-1",
      });
    });

    it("should list embed tokens for current client", async () => {
      const mockTokens = [{ id: "emb-1", name: "Main Site" }];
      mockClientsService.listEmbedTokens.mockResolvedValue(mockTokens);

      const result = await controller.listMyEmbedTokens(mockUser);
      expect(result).toEqual(mockTokens);
      expect(service.listEmbedTokens).toHaveBeenCalledWith(
        mockUser,
        "client-1",
      );
    });

    it("should revoke embed token", async () => {
      const mockResult = { message: "Embed token revoked successfully" };
      mockClientsService.revokeEmbedToken.mockResolvedValue(mockResult);

      const result = await controller.revokeEmbedToken(mockUser, "emb-1");
      expect(result).toEqual(mockResult);
      expect(service.revokeEmbedToken).toHaveBeenCalledWith(mockUser, "emb-1");
    });
  });

  describe("Overlay Tokens", () => {
    it("should generate/reissue overlay token for current client match", async () => {
      const mockResult = {
        id: "ovl-1",
        token: "ovl_secret",
        matchId: "match-1",
      };
      mockClientsService.createOrReissueOverlayToken.mockResolvedValue(
        mockResult,
      );

      const result = await controller.createMyOverlayToken(
        mockUser,
        "match-1",
        { expiresInHours: 12 },
      );

      expect(result).toEqual(mockResult);
      expect(service.createOrReissueOverlayToken).toHaveBeenCalledWith(
        mockUser,
        {
          clientId: "client-1",
          matchId: "match-1",
          expiresInHours: 12,
        },
      );
    });

    it("should get active overlay token for match", async () => {
      const mockResult = { id: "ovl-1", matchId: "match-1" };
      mockClientsService.getActiveOverlayToken.mockResolvedValue(mockResult);

      const result = await controller.getMyOverlayToken(mockUser, "match-1");
      expect(result).toEqual(mockResult);
      expect(service.getActiveOverlayToken).toHaveBeenCalledWith(
        mockUser,
        "client-1",
        "match-1",
      );
    });

    it("should revoke overlay token", async () => {
      const mockResult = { message: "Overlay token revoked successfully" };
      mockClientsService.revokeOverlayToken.mockResolvedValue(mockResult);

      const result = await controller.revokeOverlayToken(mockUser, "ovl-1");
      expect(result).toEqual(mockResult);
      expect(service.revokeOverlayToken).toHaveBeenCalledWith(
        mockUser,
        "ovl-1",
      );
    });
  });

  describe("Overlay Scenes (Control Channel)", () => {
    const mockScene = {
      activeScene: "player_spotlight",
      visible: true,
      scorebugVisible: true,
      autoDismissAt: null,
      payload: { v: 1 },
      updatedAt: new Date(),
    };

    it("should get client overlay scenes", async () => {
      mockClientsService.getMyOverlays.mockResolvedValue([mockScene]);
      const res = await controller.getMyOverlays(mockUser, "match-1");
      expect(res).toEqual([mockScene]);
      expect(service.getMyOverlays).toHaveBeenCalledWith(mockUser, "match-1");
    });

    it("should get overlay scene by matchId", async () => {
      mockClientsService.getMyOverlayByMatch.mockResolvedValue(mockScene);
      const res = await controller.getMyOverlayByMatch(mockUser, "match-1");
      expect(res).toEqual(mockScene);
      expect(service.getMyOverlayByMatch).toHaveBeenCalledWith(
        mockUser,
        "match-1",
      );
    });

    it("should upsert overlay scene", async () => {
      mockClientsService.upsertMyOverlay.mockResolvedValue(mockScene);
      const dto = {
        matchId: "match-1",
        activeScene: "player_spotlight" as const,
      };
      const res = await controller.upsertMyOverlay(mockUser, dto);
      expect(res).toEqual(mockScene);
      expect(service.upsertMyOverlay).toHaveBeenCalledWith(mockUser, dto);
    });

    it("should patch overlay scene with param", async () => {
      mockClientsService.patchMyOverlay.mockResolvedValue(mockScene);
      const dto = { visible: true };
      const res = await controller.patchMyOverlayWithParam(
        mockUser,
        "match-1",
        dto,
      );
      expect(res).toEqual(mockScene);
      expect(service.patchMyOverlay).toHaveBeenCalledWith(
        mockUser,
        "match-1",
        dto,
      );
    });

    it("should reset overlay scene with param", async () => {
      const mockReset = { success: true, message: "Reset" };
      mockClientsService.resetMyOverlay.mockResolvedValue(mockReset);
      const res = await controller.resetMyOverlayWithParam(mockUser, "match-1");
      expect(res).toEqual(mockReset);
      expect(service.resetMyOverlay).toHaveBeenCalledWith(mockUser, "match-1");
    });
  });
});
