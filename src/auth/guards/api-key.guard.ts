import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";
import type { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("API key or token is missing");
    }

    const keyHash = crypto.createHash("sha256").update(token).digest("hex");

    // 1. Check ClientApiKey
    const clientApiKey = await this.prisma.clientApiKey.findUnique({
      where: { keyHash },
      include: { client: true },
    });

    if (clientApiKey) {
      if (!clientApiKey.client.isActive) {
        throw new UnauthorizedException("Invalid or inactive API key");
      }

      request.user = {
        clientIds: [clientApiKey.clientId],
        role: "EXTERNAL_CLIENT",
        tokenType: "API_KEY",
        scopes: clientApiKey.scopes ?? [],
      };

      this.prisma.clientApiKey
        .update({
          where: { id: clientApiKey.id },
          data: { lastUsed: new Date() },
        })
        .catch(() => {});

      return true;
    }

    // 2. Check ClientEmbedToken (Read-only, origin enforced)
    const embedToken = await this.prisma.clientEmbedToken.findUnique({
      where: { tokenHash: keyHash },
      include: { client: true },
    });

    if (embedToken) {
      if (!embedToken.isActive || embedToken.revokedAt) {
        throw new UnauthorizedException("Embed token has been revoked");
      }

      if (!embedToken.client.isActive) {
        throw new UnauthorizedException("Invalid or inactive client");
      }

      // Origin check
      this.validateEmbedOrigin(request, embedToken.allowedOrigins);

      request.user = {
        clientIds: [embedToken.clientId],
        role: "EXTERNAL_CLIENT",
        tokenType: "EMBED_TOKEN",
      };

      this.prisma.clientEmbedToken
        .update({
          where: { id: embedToken.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});

      return true;
    }

    // 3. Check ClientOverlayToken (Scoped to match, hour-based expiry)
    const overlayToken = await this.prisma.clientOverlayToken.findUnique({
      where: { tokenHash: keyHash },
      include: { client: true },
    });

    if (overlayToken) {
      if (!overlayToken.isActive || overlayToken.revokedAt) {
        throw new UnauthorizedException("Overlay token has been revoked");
      }

      if (!overlayToken.client.isActive) {
        throw new UnauthorizedException("Invalid or inactive client");
      }

      if (new Date() > overlayToken.expiresAt) {
        throw new UnauthorizedException("Overlay token has expired");
      }

      // Scope check: only permitted for this match
      this.validateOverlayScope(request, overlayToken.matchId);

      request.user = {
        clientIds: [overlayToken.clientId],
        role: "EXTERNAL_CLIENT",
        tokenType: "OVERLAY_TOKEN",
        matchId: overlayToken.matchId,
      };

      this.prisma.clientOverlayToken
        .update({
          where: { id: overlayToken.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});

      return true;
    }

    throw new UnauthorizedException("Invalid or inactive API key or token");
  }

  private extractToken(request: Request): string | null {
    const fromHeader =
      request.headers["x-embed-token"] ||
      request.headers["x-overlay-token"] ||
      request.headers["x-api-key"] ||
      request.headers["x-token"];

    if (typeof fromHeader === "string" && fromHeader.trim().length > 0) {
      return fromHeader.trim();
    }

    const query = request.query as Record<string, unknown> | undefined;
    const fromQuery =
      query?.embedToken || query?.overlayToken || query?.apiKey || query?.token;

    if (typeof fromQuery === "string" && fromQuery.trim().length > 0) {
      return fromQuery.trim();
    }

    // Fallback: search URL query string directly
    const rawUrl = request.originalUrl || request.url;
    if (rawUrl && rawUrl.includes("?")) {
      try {
        const queryString = rawUrl.slice(rawUrl.indexOf("?") + 1);
        const params = new URLSearchParams(queryString);
        const token =
          params.get("embedToken") ||
          params.get("overlayToken") ||
          params.get("apiKey") ||
          params.get("token");
        if (token && token.trim().length > 0) {
          return token.trim();
        }
      } catch {
        // Ignore URL parse errors
      }
    }

    return null;
  }

  private validateEmbedOrigin(
    request: Request,
    allowedOrigins: string[],
  ): void {
    if (!allowedOrigins || allowedOrigins.length === 0) {
      return;
    }

    const rawOrigin =
      request.headers["origin"] ||
      request.headers["referer"] ||
      request.headers["x-forwarded-host"];

    if (!rawOrigin || typeof rawOrigin !== "string") {
      throw new ForbiddenException(
        "Origin header is required for embed token access",
      );
    }

    let requestOrigin = rawOrigin.trim();
    try {
      const parsed = new URL(requestOrigin);
      requestOrigin = parsed.origin;
    } catch {
      requestOrigin = requestOrigin.replace(/\/+$/, "");
    }

    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === "*") return true;
      try {
        return new URL(allowed).origin === requestOrigin;
      } catch {
        return allowed.replace(/\/+$/, "") === requestOrigin;
      }
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        `Origin '${rawOrigin}' is not allowed for this embed token`,
      );
    }
  }

  private validateOverlayScope(request: Request, matchId: string): void {
    const params = request.params as Record<string, string> | undefined;
    if (params?.matchId && params.matchId === matchId) {
      return;
    }

    const url = request.originalUrl || request.url || "";
    const matchRegex = /\/matches\/([a-zA-Z0-9_-]+)/;
    const match = url.match(matchRegex);

    if (!match || !match[1]) {
      throw new ForbiddenException(
        "Overlay token is scoped only to match data and streams",
      );
    }

    const requestedMatchId = match[1];
    if (requestedMatchId !== matchId) {
      throw new ForbiddenException(
        `Overlay token is scoped only to match ${matchId}`,
      );
    }
  }
}
