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

describe("ClientsService", () => {
  let service: ClientsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            clientUser: {
              create: jest.fn(),
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
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    prisma = module.get<PrismaService>(PrismaService);
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

      // Verify the hash was passed to DB
      expect(prisma.clientApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keyHash: expect.any(String),
            clientId: "client1",
            name: "Test Key",
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
  });
});
