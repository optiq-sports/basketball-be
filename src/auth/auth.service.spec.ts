import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { UnauthorizedException, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue("test-secret"),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should return access token on successful login", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "password123",
      };

      const mockUser = {
        id: "user1",
        email: "test@example.com",
        password: "hashedPassword",
        role: "ADMIN",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue("token123");
      mockPrismaService.session.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("user");
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException on invalid credentials", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("register", () => {
    it("should create new user and return tokens", async () => {
      const registerDto = {
        email: "new@example.com",
        password: "password123",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashedPassword");
      mockPrismaService.user.create.mockResolvedValue({
        id: "user1",
        email: "new@example.com",
        role: "STATISTICIAN",
      });
      mockJwtService.sign.mockReturnValue("token123");
      mockPrismaService.session.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("user");
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it("should throw ConflictException if user already exists", async () => {
      const registerDto = {
        email: "existing@example.com",
        password: "password123",
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "existing",
        email: "existing@example.com",
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("refresh", () => {
    it("should throw an error if session is not found", async () => {
      (mockPrismaService.session.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.refresh("invalid_token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw an error if jwt verification fails", async () => {
      const session = {
        id: "session-id",
        user: {
          id: "user-id",
          email: "test@example.com",
          role: Role.ADMIN,
          status: "ACTIVE",
        },
      };
      (mockPrismaService.session.findFirst as jest.Mock).mockResolvedValue(
        session,
      );
      (mockJwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(service.refresh("expired_token")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.session.delete).toHaveBeenCalledWith({
        where: { id: session.id },
      });
    });

    it("should successfully refresh the token", async () => {
      const session = {
        id: "session-id",
        user: {
          id: "user-id",
          email: "test@example.com",
          role: Role.ADMIN,
          status: "ACTIVE",
        },
      };
      (mockPrismaService.session.findFirst as jest.Mock).mockResolvedValue(
        session,
      );
      (mockJwtService.verify as jest.Mock).mockReturnValue({ sub: "user-id" });
      (mockJwtService.sign as jest.Mock)
        .mockReturnValueOnce("new-access-token")
        .mockReturnValueOnce("new-refresh-token");
      (mockConfigService.get as jest.Mock).mockReturnValue("24h");

      const result = await service.refresh("valid-refresh-token");

      expect(result).toEqual({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: expect.any(Number),
        refresh_token_expires_in: expect.any(Number),
        token_type: "Bearer",
        user: {
          id: "user-id",
          email: "test@example.com",
          name: null,
          role: Role.ADMIN,
        },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("should delete session if found", async () => {
      (mockPrismaService.session.findFirst as jest.Mock).mockResolvedValue({
        id: "session-id",
      });
      const result = await service.logout("valid-token");

      expect(mockPrismaService.session.delete).toHaveBeenCalledWith({
        where: { id: "session-id" },
      });
      expect(result).toEqual({ success: true });
    });

    it("should not throw if session is not found", async () => {
      (mockPrismaService.session.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      const result = await service.logout("invalid-token");

      expect(result).toEqual({ success: true });
    });
  });
});
