import { Test, TestingModule } from "@nestjs/testing";
import { ClientsService } from "./clients.service";
import { EmailService } from "../notifications/email.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CreateClientDto } from "./dto/create-client.dto";
import { AuthenticatedUser } from "src/common/interfaces/user.interface";
import { Role } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

describe("ClientsService", () => {
  let service: ClientsService;
  let prisma: PrismaService;
  let emailService: EmailService;

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
              update: jest.fn(),
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
      ],
    }).compile();

    service = testingModule.get<ClientsService>(ClientsService);
    prisma = testingModule.get<PrismaService>(PrismaService);
    emailService = testingModule.get<EmailService>(EmailService);
  });

  const mockUser: AuthenticatedUser = {
    id: "user1",
    email: "test@example.com",
    role: Role.CLIENT,
    clientIds: ["client1"],
  };

  const adminUser: AuthenticatedUser = {
    id: "admin1",
    email: "admin@example.com",
    role: Role.ADMIN,
    clientIds: ["client1"],
  };

  const otherAdmin: AuthenticatedUser = {
    id: "admin2",
    email: "admin2@example.com",
    role: Role.ADMIN,
    clientIds: ["client2"],
  };

  const superAdminUser: AuthenticatedUser = {
    id: "superadmin1",
    email: "super@example.com",
    role: Role.SUPER_ADMIN,
    clientIds: [],
  };

  describe("API Keys", () => {
    it("should create an API key for authorized client", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });
      (prisma.clientApiKey.create as jest.Mock).mockResolvedValue({
        id: "key1",
        clientId: "client1",
        name: "Test Key",
      });

      const dto: CreateApiKeyDto = { name: "Test Key", clientId: "client1" };
      const result = await service.createApiKey(mockUser, dto);

      expect(result).toHaveProperty("apiKey");
      expect(result.apiKey.startsWith("optiq_")).toBe(true);
      expect(prisma.clientApiKey.create).toHaveBeenCalled();
    });

    it("should throw ForbiddenException if user lacks access to client", async () => {
      const dto: CreateApiKeyDto = { name: "Test Key", clientId: "client2" };
      await expect(service.createApiKey(mockUser, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("listClientUsers", () => {
    it("should reject admin outside of client with ForbiddenException", async () => {
      await expect(
        service.listClientUsers(otherAdmin, "client1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should list users linked to a client for authorized admin", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });
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

      const result = await service.listClientUsers(adminUser, "client1");

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("c@example.com");
    });
  });

  describe("unlinkUserFromClient", () => {
    it("should reject admin outside of client with ForbiddenException", async () => {
      await expect(
        service.unlinkUserFromClient("client1", "u1", otherAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should delete the clientUser link for authorized admin", async () => {
      (prisma.clientUser.findUnique as jest.Mock).mockResolvedValue({
        clientId: "client1",
        userId: "u1",
      });
      (prisma.clientUser.delete as jest.Mock).mockResolvedValue({});

      const result = await service.unlinkUserFromClient(
        "client1",
        "u1",
        adminUser,
      );

      expect(result.success).toBe(true);
      expect(prisma.clientUser.delete).toHaveBeenCalledWith({
        where: { clientId_userId: { clientId: "client1", userId: "u1" } },
      });
    });

    it("should throw NotFoundException if link does not exist", async () => {
      (prisma.clientUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.unlinkUserFromClient("client1", "u1", adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("assignUserToClient", () => {
    it("should reject admin outside of client with ForbiddenException", async () => {
      await expect(
        service.assignUserToClient("client1", { userId: "u1" }, otherAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should update user role to CLIENT if not already CLIENT", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });
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
        clientId: "client1",
        userId: "u1",
      });

      await service.assignUserToClient("client1", { userId: "u1" }, adminUser);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { role: Role.CLIENT },
      });
      expect(prisma.clientUser.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException if assigning a SUPER_ADMIN", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "u1",
        role: Role.SUPER_ADMIN,
      });

      await expect(
        service.assignUserToClient("client1", { userId: "u1" }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateClient", () => {
    it("should reject admin outside of client with ForbiddenException", async () => {
      await expect(
        service.updateClient(otherAdmin, "client1", { name: "New Name" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should update client for authorized admin", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });
      (prisma.client.update as jest.Mock).mockResolvedValue({
        id: "client1",
        name: "New Name",
      });

      const res = await service.updateClient(adminUser, "client1", {
        name: "New Name",
      });
      expect(res.name).toBe("New Name");
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: "client1" },
        data: { name: "New Name" },
      });
    });
  });

  describe("deleteClient", () => {
    it("should reject non-SUPER_ADMIN with ForbiddenException", async () => {
      await expect(service.deleteClient("client1", adminUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should allow SUPER_ADMIN to delete client", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });
      (prisma.client.update as jest.Mock).mockResolvedValue({
        id: "client1",
        isActive: false,
      });

      const res = await service.deleteClient("client1", superAdminUser);
      expect(res.isActive).toBe(false);
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: "client1" },
        data: { isActive: false },
      });
    });
  });

  describe("Embed Tokens", () => {
    it("should create and return raw embed token once", async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: "client1",
      });

      const createdRecord = {
        id: "emb_1",
        clientId: "client1",
        name: "Web Portal",
        allowedOrigins: ["https://example.com"],
        isActive: true,
        createdAt: new Date(),
      };
      (prisma.clientEmbedToken.create as jest.Mock).mockResolvedValue(
        createdRecord,
      );

      const result = await service.createEmbedToken(mockUser, {
        name: "Web Portal",
        allowedOrigins: ["https://example.com"],
        clientId: "client1",
      });

      expect(result.token).toBeDefined();
      expect(result.token?.startsWith("emb_")).toBe(true);
      expect(result.allowedOrigins).toEqual(["https://example.com"]);
      expect(prisma.clientEmbedToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: "client1",
          name: "Web Portal",
          allowedOrigins: ["https://example.com"],
          tokenHash: expect.any(String),
          tokenPrefix: expect.any(String),
        }),
      });
    });

    it("should list embed tokens without exposing token hash", async () => {
      const mockTokens = [
        {
          id: "emb_1",
          name: "Web Portal",
          allowedOrigins: ["https://example.com"],
          tokenPrefix: "emb_12345678...",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: null,
          revokedAt: null,
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
});
