import { ApiKeyGuard } from "./api-key.guard";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
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
    } as any;
    guard = new ApiKeyGuard(prismaService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should throw UnauthorizedException if no API key is provided", async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      "API key is missing",
    );
  });

  it("should throw UnauthorizedException if API key is invalid", async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key": "invalid_key",
          },
        }),
      }),
    } as ExecutionContext;

    (prismaService.clientApiKey.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      "Invalid or inactive API key",
    );
  });

  it("should throw UnauthorizedException if client is inactive", async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            "x-api-key": "valid_key_but_inactive_client",
          },
        }),
      }),
    } as ExecutionContext;

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
      user: undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

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
    });

    // Check if the hash matches what's expected for 'valid_key'
    const expectedHash = crypto
      .createHash("sha256")
      .update("valid_key")
      .digest("hex");
    expect(prismaService.clientApiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: expectedHash },
      include: { client: true },
    });

    // Check if last used is updated
    expect(prismaService.clientApiKey.update).toHaveBeenCalledWith({
      where: { id: "api_key_1" },
      data: { lastUsed: expect.any(Date) },
    });
  });
});
