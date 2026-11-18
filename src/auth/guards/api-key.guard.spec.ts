import { ApiKeyGuard } from "./api-key.guard";
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = {
      clientApiKey: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      clientEmbedToken: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      clientOverlayToken: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    guard = new ApiKeyGuard(prismaService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("API Key handling", () => {
    it("should throw UnauthorizedException if no API key or token is provided", async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
            query: {},
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "API key or token is missing",
      );
    });

    it("should throw UnauthorizedException if API key is invalid", async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              "x-api-key": "invalid_key",
            },
            query: {},
          }),
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.clientOverlayToken.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Invalid or inactive API key or token",
      );
    });

    it("should throw UnauthorizedException if client is inactive", async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              "x-api-key": "valid_key_but_inactive_client",
            },
            query: {},
          }),
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue({
        clientId: "client_id_1",
        client: { isActive: false },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Invalid or inactive API key",
      );
    });

    it("should return true and assign user to request if API key is valid and client is active", async () => {
      const mockRequest = {
        headers: {
          "x-api-key": "valid_key",
        },
        query: {},
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "api_key_1",
        clientId: "client_id_1",
        client: { isActive: true },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        clientIds: ["client_id_1"],
        role: "EXTERNAL_CLIENT",
        tokenType: "API_KEY",
        scopes: [],
      });

      const expectedHash = crypto
        .createHash("sha256")
        .update("valid_key")
        .digest("hex");
      expect(prismaService.clientApiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: expectedHash },
        include: { client: true },
      });
    });

    it("should assign scopes to request.user when clientApiKey has scopes", async () => {
      const mockRequest = {
        headers: {
          "x-api-key": "scoped_key",
        },
        query: {},
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "api_key_scoped",
        clientId: "client_id_1",
        scopes: ["advanced_analytics"],
        client: { isActive: true },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        clientIds: ["client_id_1"],
        role: "EXTERNAL_CLIENT",
        tokenType: "API_KEY",
        scopes: ["advanced_analytics"],
      });
    });
  });

  describe("Embed Token handling", () => {
    it("should allow request when origin is allowed", async () => {
      const mockRequest = {
        headers: {
          "x-embed-token": "emb_token_123",
          origin: "https://myclub.com",
        },
        query: {},
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "emb_1",
        clientId: "client_1",
        allowedOrigins: ["https://myclub.com", "http://localhost:3000"],
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        clientIds: ["client_1"],
        role: "EXTERNAL_CLIENT",
        tokenType: "EMBED_TOKEN",
        scopes: [],
      });
    });

    it("should assign scopes to request.user when embed token has scopes", async () => {
      const mockRequest = {
        headers: {
          "x-embed-token": "emb_token_123",
          origin: "https://myclub.com",
        },
        query: {},
        user: undefined as unknown,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "emb_1",
        clientId: "client_1",
        allowedOrigins: ["https://myclub.com"],
        scopes: ["advanced_analytics"],
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        clientIds: ["client_1"],
        role: "EXTERNAL_CLIENT",
        tokenType: "EMBED_TOKEN",
        scopes: ["advanced_analytics"],
      });
    });

    it("should refuse embed token from an origin not on its list", async () => {
      const mockRequest = {
        headers: {
          "x-embed-token": "emb_token_123",
          origin: "https://unauthorized-origin.com",
        },
        query: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "emb_1",
        clientId: "client_1",
        allowedOrigins: ["https://myclub.com"],
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Origin 'https://unauthorized-origin.com' is not allowed for this embed token",
      );
    });

    it("should refuse embed token if origin header is missing", async () => {
      const mockRequest = {
        headers: {
          "x-embed-token": "emb_token_123",
        },
        query: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "emb_1",
        clientId: "client_1",
        allowedOrigins: ["https://myclub.com"],
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Origin header is required for embed token access",
      );
    });

    it("should refuse revoked embed token", async () => {
      const mockRequest = {
        headers: {
          "x-embed-token": "emb_token_revoked",
          origin: "https://myclub.com",
        },
        query: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "emb_1",
        clientId: "client_1",
        allowedOrigins: ["https://myclub.com"],
        isActive: false,
        revokedAt: new Date(),
        client: { isActive: true },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Embed token has been revoked",
      );
    });
  });

  describe("Overlay Token handling", () => {
    it("should allow overlay token scoped to match", async () => {
      const mockRequest = {
        headers: {
          "x-overlay-token": "ovl_token_123",
        },
        params: { matchId: "match_123" },
        originalUrl: "/api/v1/client/matches/match_123/stream",
        query: {},
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.clientOverlayToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "ovl_1",
        clientId: "client_1",
        matchId: "match_123",
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour in the future
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        clientIds: ["client_1"],
        role: "EXTERNAL_CLIENT",
        tokenType: "OVERLAY_TOKEN",
        matchId: "match_123",
      });
    });

    it("should allow overlay token passed via query parameter (e.g. for OBS/vMix)", async () => {
      const mockRequest = {
        headers: {},
        query: { token: "ovl_token_123" },
        params: { matchId: "match_123" },
        originalUrl:
          "/api/v1/client/matches/match_123/stream?token=ovl_token_123",
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.clientOverlayToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "ovl_1",
        clientId: "client_1",
        matchId: "match_123",
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it("should refuse expired overlay token", async () => {
      const mockRequest = {
        headers: {
          "x-overlay-token": "ovl_token_expired",
        },
        params: { matchId: "match_123" },
        originalUrl: "/api/v1/client/matches/match_123/stream",
        query: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.clientOverlayToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "ovl_1",
        clientId: "client_1",
        matchId: "match_123",
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Overlay token has expired",
      );
    });

    it("should refuse revoked overlay token", async () => {
      const mockRequest = {
        headers: {
          "x-overlay-token": "ovl_token_revoked",
        },
        params: { matchId: "match_123" },
        originalUrl: "/api/v1/client/matches/match_123/stream",
        query: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.clientOverlayToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "ovl_1",
        clientId: "client_1",
        matchId: "match_123",
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: false,
        revokedAt: new Date(),
        client: { isActive: true },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Overlay token has been revoked",
      );
    });

    it("should refuse overlay token when used on a different match", async () => {
      const mockRequest = {
        headers: {
          "x-overlay-token": "ovl_token_123",
        },
        params: { matchId: "other_match_999" },
        originalUrl: "/api/v1/client/matches/other_match_999/stream",
        query: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        prismaService.clientEmbedToken.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.clientOverlayToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: "ovl_1",
        clientId: "client_1",
        matchId: "match_123",
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: true,
        revokedAt: null,
        client: { isActive: true },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Overlay token is scoped only to match match_123",
      );
    });
  });
});
