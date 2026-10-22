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
    updateClient: jest.fn(),
    deleteClient: jest.fn(),
    assignUserToClient: jest.fn(),
    listClientUsers: jest.fn(),
    unlinkUserFromClient: jest.fn(),
    createEmbedToken: jest.fn(),
    listEmbedTokens: jest.fn(),
    revokeEmbedToken: jest.fn(),
  };

  const mockUser: AuthenticatedUser = {
    id: "user-1",
    email: "client@example.com",
    name: "Client User",
    role: Role.CLIENT,
    clientIds: ["client-1"],
  };

  const adminUser: AuthenticatedUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User",
    role: Role.ADMIN,
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

      const result = await controller.listClientUsers(adminUser, "client-1");
      expect(result).toEqual(mockUsers);
      expect(service.listClientUsers).toHaveBeenCalledWith(
        adminUser,
        "client-1",
      );
    });
  });

  describe("unlinkUserFromClient", () => {
    it("should unlink user from client", async () => {
      const mockResponse = {
        message: "User unlinked from client successfully",
      };
      mockClientsService.unlinkUserFromClient.mockResolvedValue(mockResponse);

      const result = await controller.unlinkUserFromClient(
        adminUser,
        "client-1",
        "user-1",
      );
      expect(result).toEqual(mockResponse);
      expect(service.unlinkUserFromClient).toHaveBeenCalledWith(
        "client-1",
        "user-1",
        adminUser,
      );
    });
  });

  describe("assignUserToClient", () => {
    it("should assign user to client", async () => {
      const dto: AssignUserDto = { userId: "user-2" };
      const mockResult = { clientId: "client-1", userId: "user-2" };
      mockClientsService.assignUserToClient.mockResolvedValue(mockResult);

      const result = await controller.assignUserToClient(
        adminUser,
        "client-1",
        dto,
      );
      expect(result).toEqual(mockResult);
      expect(service.assignUserToClient).toHaveBeenCalledWith(
        "client-1",
        dto,
        adminUser,
      );
    });
  });

  describe("updateClient", () => {
    it("should update client passing actor user", async () => {
      const updateData = { name: "Updated Name" };
      const mockResult = { id: "client-1", name: "Updated Name" };
      mockClientsService.updateClient.mockResolvedValue(mockResult);

      const result = await controller.updateClient(
        adminUser,
        "client-1",
        updateData,
      );
      expect(result).toEqual(mockResult);
      expect(service.updateClient).toHaveBeenCalledWith(
        adminUser,
        "client-1",
        updateData,
      );
    });
  });

  describe("deleteClient", () => {
    it("should delete client passing actor user", async () => {
      const mockResult = { id: "client-1", isActive: false };
      mockClientsService.deleteClient.mockResolvedValue(mockResult);

      const result = await controller.deleteClient(adminUser, "client-1");
      expect(result).toEqual(mockResult);
      expect(service.deleteClient).toHaveBeenCalledWith("client-1", adminUser);
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
});
