import { Test, TestingModule } from "@nestjs/testing";
import { ClientsService } from "./clients.service";
import { EmailService } from "../notifications/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import * as crypto from "crypto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CreateClientDto } from "./dto/create-client.dto";
import { AuthenticatedUser } from "src/common/interfaces/user.interface";
import { Role } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { OverlayService } from "../overlay/overlay.service";

describe("ClientsService", () => {
  let service: ClientsService;
  let prisma: PrismaService;
  let emailService: EmailService;
  let overlayService: OverlayService;

  const mockOverlayService = {
    listScenes: jest.fn(),
    getSceneState: jest.fn(),
    upsertScene: jest.fn(),
    patchScene: jest.fn(),
    resetScene: jest.fn(),
  };

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              findUnique: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            clientApiKey: {
              create: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
            },
            clientEmbedToken: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            clientOverlayToken: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            match: {
              findFirst: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            clientUser: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest
              .fn()
              .mockImplementation(async (cb) => cb(prisma)),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            recordLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
            findAll: jest.fn(),
          },
        },
        {
          provide: OverlayService,
          useValue: mockOverlayService,
        },
      ],
    }).compile();

    service = testingModule.get<ClientsService>(ClientsService);
    prisma = testingModule.get<PrismaService>(PrismaService);
    emailService = testingModule.get<EmailService>(EmailService);
    overlayService = testingModule.get<OverlayService>(OverlayService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  const mockUser: AuthenticatedUser = {
    id: "user1",
    email: "user@test.com",
    name: "Test User",
    role: Role.CLIENT,
    clientIds: ["client1"],
  };

  describe("createApiKey", () => {
    it("should throw if client not found", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      const dto: CreateApiKeyDto = { clientId: "client1", name: "Test Key" };

      await expect(service.createApiKey(mockUser, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should create and return raw api key once", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });

      const createdRecord = {
        id: "key1",
        name: "Test Key",
        clientId: "client1",
        scopes: [],
        createdAt: new Date(),
      };
      (prisma.clientApiKey.create as jest.Mock).mockResolvedValue(
        createdRecord,
      );

      const dto: CreateApiKeyDto = { clientId: "client1", name: "Test Key" };
      const result = await service.createApiKey(mockUser, dto);

      expect(result.apiKey).toBeDefined();
      expect(result.apiKey.startsWith("optiq_")).toBe(true);
      expect(result.clientId).toBe("client1");
      expect(result.name).toBe("Test Key");
      expect(result.scopes).toEqual([]);

      // Verify the hash was passed to DB
      expect(prisma.clientApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keyHash: expect.any(String),
            clientId: "client1",
            name: "Test Key",
            scopes: [],
          }),
        }),
      );
    });

    it("should allow SUPER_ADMIN to set scopes", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });

      const superAdminUser: AuthenticatedUser = {
        id: "super1",
        email: "super@test.com",
        name: "Super Admin",
        role: Role.SUPER_ADMIN,
      };

      const createdRecord = {
        id: "key2",
        name: "Analytics Key",
        clientId: "client1",
        scopes: ["advanced_analytics"],
        createdAt: new Date(),
      };
      (prisma.clientApiKey.create as jest.Mock).mockResolvedValue(
        createdRecord,
      );

      const dto: CreateApiKeyDto = {
        clientId: "client1",
        name: "Analytics Key",
        scopes: ["advanced_analytics"],
      };
      const result = await service.createApiKey(superAdminUser, dto);

      expect(result.scopes).toEqual(["advanced_analytics"]);
      expect(prisma.clientApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scopes: ["advanced_analytics"],
          }),
        }),
      );
    });

    it("should ignore scopes when created by non-SUPER_ADMIN user", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });

      const createdRecord = {
        id: "key3",
        name: "Attempted Scoped Key",
        clientId: "client1",
        scopes: [],
        createdAt: new Date(),
      };
      (prisma.clientApiKey.create as jest.Mock).mockResolvedValue(
        createdRecord,
      );

      const dto: CreateApiKeyDto = {
        clientId: "client1",
        name: "Attempted Scoped Key",
        scopes: ["advanced_analytics"],
      };
      const result = await service.createApiKey(mockUser, dto);

      expect(result.scopes).toEqual([]);
      expect(prisma.clientApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scopes: [],
          }),
        }),
      );
    });
  });

  describe("createClient", () => {
    it("should create a client", async () => {
      const dto: CreateClientDto = {
        name: "Test Client",
        websiteUrl: "https://test.com",
        userEmail: "client1@test.com",
        userFirstName: "John",
        userLastName: "Doe",
      };
      const mockResult = {
        id: "client1",
        name: dto.name,
        websiteUrl: dto.websiteUrl,
      };
      const mockUserResult = { id: "user1", email: dto.userEmail };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.client.create as jest.Mock).mockResolvedValue(mockResult);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUserResult);
      (prisma.clientUser.create as jest.Mock).mockResolvedValue({});

      const result = await service.createClient(dto);

      expect(result).toEqual({ ...mockResult, emailSent: true });
      expect(prisma.client.create).toHaveBeenCalledWith({
        data: { name: dto.name, websiteUrl: dto.websiteUrl },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.clientUser.create).toHaveBeenCalled();
    });

    it("should return emailSent false when sendWelcomeEmail fails", async () => {
      (emailService.sendWelcomeEmail as jest.Mock).mockResolvedValueOnce(false);

      const dto: CreateClientDto = {
        name: "Test Client 2",
        websiteUrl: "https://test2.com",
        userEmail: "client2@test.com",
        userFirstName: "Jane",
        userLastName: "Doe",
      };
      const mockResult = { id: "client2", name: dto.name };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.client.create as jest.Mock).mockResolvedValue(mockResult);
      (prisma.user.create as jest.Mock).mockResolvedValue({ id: "user2" });
      (prisma.clientUser.create as jest.Mock).mockResolvedValue({});

      const result = await service.createClient(dto);

      expect(result.emailSent).toBe(false);
    });
  });

  describe("getMyClient", () => {
    it("should return the client organisation for assigned user", async () => {
      const mockClient = {
        id: "client1",
        name: "My Org",
        slug: "myorg",
        clientType: "standard",
        websiteUrl: "https://org.com",
        logo: "https://org.com/logo.png",
      };
      (prisma.client.findUnique as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.getMyClient(mockUser);

      expect(result).toEqual(mockClient);
      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: "client1" },
        select: {
          id: true,
          name: true,
          slug: true,
          clientType: true,
          websiteUrl: true,
          logo: true,
        },
      });
    });

    it("should throw ForbiddenException if user has no clientIds", async () => {
      const userWithoutClient: AuthenticatedUser = {
        ...mockUser,
        clientIds: [],
      };

      await expect(service.getMyClient(userWithoutClient)).rejects.toThrow();
    });

    it("should throw NotFoundException if client not found", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getMyClient(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("listClients", () => {
    it("should filter by search term when provided", async () => {
      (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.count as jest.Mock).mockResolvedValue(0);

      await service.listClients({ search: "Metro" });

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: "Metro", mode: "insensitive" } },
        }),
      );
    });
  });

  describe("listClientUsers", () => {
    it("should list users linked to a client", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({ id: "c1" });
      const mockClientUsers = [
        {
          user: {
            id: "u1",
            email: "c@example.com",
            name: "Client",
            role: Role.CLIENT,
            createdAt: new Date(),
          },
        },
      ];
      (prisma.clientUser.findMany as jest.Mock).mockResolvedValue(
        mockClientUsers,
      );

      const result = await service.listClientUsers("c1");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("c@example.com");
    });
  });

  describe("unlinkUserFromClient", () => {
    it("should delete the clientUser link", async () => {
      (prisma.clientUser.findUnique as jest.Mock).mockResolvedValue({
        clientId: "c1",
        userId: "u1",
      });
      (prisma.clientUser.delete as jest.Mock).mockResolvedValue({});

      const result = await service.unlinkUserFromClient("c1", "u1");

      expect(result.success).toBe(true);
      expect(prisma.clientUser.delete).toHaveBeenCalledWith({
        where: { clientId_userId: { clientId: "c1", userId: "u1" } },
      });
    });

    it("should throw NotFoundException if link does not exist", async () => {
      (prisma.clientUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.unlinkUserFromClient("c1", "u1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("assignUserToClient", () => {
    it("should update user role to CLIENT if not already CLIENT", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({ id: "c1" });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "u1",
        role: Role.ADMIN,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: "u1",
        role: Role.CLIENT,
      });
      (prisma.clientUser.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.clientUser.create as jest.Mock).mockResolvedValue({
        clientId: "c1",
        userId: "u1",
      });

      await service.assignUserToClient("c1", { userId: "u1" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { role: Role.CLIENT },
      });
      expect(prisma.clientUser.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException if assigning a SUPER_ADMIN", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({ id: "c1" });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "u1",
        role: Role.SUPER_ADMIN,
      });

      await expect(
        service.assignUserToClient("c1", { userId: "u1" }),
      ).rejects.toThrow();
    });
  });

  describe("Embed Tokens", () => {
    it("should create and return raw embed token once", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });

      const createdRecord = {
        id: "emb_1",
        name: "Main Site",
        clientId: "client1",
        tokenPrefix: "emb_12345678...",
        allowedOrigins: ["https://mysite.com"],
        isActive: true,
        createdAt: new Date(),
      };
      (prisma.clientEmbedToken.create as jest.Mock).mockResolvedValue(
        createdRecord,
      );

      const result = await service.createEmbedToken(mockUser, {
        name: "Main Site",
        allowedOrigins: ["https://mysite.com"],
        clientId: "client1",
      });

      expect(result.token).toBeDefined();
      expect(result.token?.startsWith("emb_")).toBe(true);
      expect(result.name).toBe("Main Site");
      expect(result.allowedOrigins).toEqual(["https://mysite.com"]);
      expect(prisma.clientEmbedToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientId: "client1",
            name: "Main Site",
            allowedOrigins: ["https://mysite.com"],
            tokenHash: expect.any(String),
          }),
        }),
      );
    });

    it("should list embed tokens for a client", async () => {
      const mockTokens = [
        {
          id: "emb_1",
          clientId: "client1",
          name: "Widget",
          tokenPrefix: "emb_1...",
          allowedOrigins: ["https://example.com"],
          isActive: true,
        },
      ];
      (prisma.clientEmbedToken.findMany as jest.Mock).mockResolvedValue(
        mockTokens,
      );

      const result = await service.listEmbedTokens(mockUser, "client1");
      expect(result).toEqual(mockTokens);
      expect(prisma.clientEmbedToken.findMany).toHaveBeenCalledWith({
        where: { clientId: "client1" },
        select: expect.any(Object),
        orderBy: { createdAt: "desc" },
      });
    });

    it("should revoke embed token", async () => {
      (prisma.clientEmbedToken.findUnique as jest.Mock).mockResolvedValue({
        id: "emb_1",
        clientId: "client1",
      });
      (prisma.clientEmbedToken.update as jest.Mock).mockResolvedValue({
        id: "emb_1",
        isActive: false,
        revokedAt: new Date(),
      });

      const result = await service.revokeEmbedToken(mockUser, "emb_1");
      expect(result.isActive).toBe(false);
      expect(prisma.clientEmbedToken.update).toHaveBeenCalledWith({
        where: { id: "emb_1" },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe("Overlay Tokens", () => {
    it("should throw NotFoundException if match not found for client", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createOrReissueOverlayToken(mockUser, {
          matchId: "nonexistent",
          clientId: "client1",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should reissue overlay token by invalidating existing tokens and creating new one", async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: "match_1",
        clientId: "client1",
      });

      (prisma.clientOverlayToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const createdRecord = {
        id: "ovl_1",
        clientId: "client1",
        matchId: "match_1",
        tokenPrefix: "ovl_12345678...",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        isActive: true,
        createdAt: new Date(),
      };
      (prisma.clientOverlayToken.create as jest.Mock).mockResolvedValue(
        createdRecord,
      );

      const result = await service.createOrReissueOverlayToken(mockUser, {
        matchId: "match_1",
        expiresInHours: 12,
        clientId: "client1",
      });

      expect(result.token).toBeDefined();
      expect(result.token?.startsWith("ovl_")).toBe(true);
      expect(result.matchId).toBe("match_1");

      expect(prisma.clientOverlayToken.updateMany).toHaveBeenCalledWith({
        where: {
          clientId: "client1",
          matchId: "match_1",
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });

      expect(prisma.clientOverlayToken.create).toHaveBeenCalled();
    });

    it("should get active overlay token for match", async () => {
      const mockToken = {
        id: "ovl_1",
        clientId: "client1",
        matchId: "match_1",
        tokenPrefix: "ovl_1...",
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: true,
      };
      (prisma.clientOverlayToken.findFirst as jest.Mock).mockResolvedValue(
        mockToken,
      );

      const result = await service.getActiveOverlayToken(
        mockUser,
        "client1",
        "match_1",
      );
      expect(result).toEqual(mockToken);
    });

    it("should revoke overlay token", async () => {
      (prisma.clientOverlayToken.findUnique as jest.Mock).mockResolvedValue({
        id: "ovl_1",
        clientId: "client1",
      });
      (prisma.clientOverlayToken.update as jest.Mock).mockResolvedValue({
        id: "ovl_1",
        isActive: false,
        revokedAt: new Date(),
      });

      const result = await service.revokeOverlayToken(mockUser, "ovl_1");
      expect(result.isActive).toBe(false);
      expect(prisma.clientOverlayToken.update).toHaveBeenCalledWith({
        where: { id: "ovl_1" },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe("Overlay Scenes", () => {
    const mockScene = {
      activeScene: "team_comparison",
      visible: true,
      scorebugVisible: true,
      autoDismissAt: null,
      payload: { v: 1 },
      updatedAt: new Date(),
    };

    it("should list my overlays", async () => {
      mockOverlayService.listScenes.mockResolvedValue([mockScene]);
      const res = await service.getMyOverlays(mockUser, "match_1");
      expect(res).toEqual([mockScene]);
      expect(mockOverlayService.listScenes).toHaveBeenCalledWith(
        "client1",
        "match_1",
      );
    });

    it("should get overlay scene by match", async () => {
      mockOverlayService.getSceneState.mockResolvedValue(mockScene);
      const res = await service.getMyOverlayByMatch(mockUser, "match_1");
      expect(res).toEqual(mockScene);
      expect(mockOverlayService.getSceneState).toHaveBeenCalledWith(
        "client1",
        "match_1",
      );
    });

    it("should upsert overlay scene", async () => {
      mockOverlayService.upsertScene.mockResolvedValue(mockScene);
      const dto = {
        matchId: "match_1",
        activeScene: "team_comparison" as const,
      };
      const res = await service.upsertMyOverlay(mockUser, dto);
      expect(res).toEqual(mockScene);
      expect(mockOverlayService.upsertScene).toHaveBeenCalledWith(
        "client1",
        "user1",
        dto,
      );
    });

    it("should patch overlay scene", async () => {
      mockOverlayService.patchScene.mockResolvedValue(mockScene);
      const dto = { visible: false };
      const res = await service.patchMyOverlay(mockUser, "match_1", dto);
      expect(res).toEqual(mockScene);
      expect(mockOverlayService.patchScene).toHaveBeenCalledWith(
        "client1",
        "user1",
        "match_1",
        dto,
      );
    });

    it("should reset overlay scene", async () => {
      const mockReset = { success: true, message: "Reset" };
      mockOverlayService.resetScene.mockResolvedValue(mockReset);
      const res = await service.resetMyOverlay(mockUser, "match_1");
      expect(res).toEqual(mockReset);
      expect(mockOverlayService.resetScene).toHaveBeenCalledWith(
        "client1",
        "user1",
        "match_1",
      );
    });
  });
});
