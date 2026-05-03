import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * SSE/EventSource cannot send Authorization headers; clients pass `access_token` as a query param.
 * Some hosts/proxies omit `req.query` for long URLs — also parse `originalUrl` / `url`.
 */
export function jwtFromBearerOrQuery(req: Request): string | null {
  const bearer = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (bearer) return bearer;

  const raw = req.query?.access_token;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromQuery === "string" && fromQuery.length > 0) {
    return fromQuery;
  }

  const search = extractQueryStringFromRequest(req);
  if (!search) return null;
  try {
    const params = new URLSearchParams(search);
    const token = params.get("access_token");
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function extractQueryStringFromRequest(req: Request): string | null {
  const candidates = [req.originalUrl, req.url];
  for (const path of candidates) {
    if (!path) continue;
    const q = path.indexOf("?");
    if (q !== -1 && q < path.length - 1) {
      return path.slice(q + 1);
    }
  }
  return null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: jwtFromBearerOrQuery,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET") || "your-secret-key",
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profile: user.profile,
    };
  }
}
