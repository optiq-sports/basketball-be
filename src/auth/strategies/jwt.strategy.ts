import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

/** SSE/EventSource cannot send Authorization headers; clients may pass token as query param. */
function jwtFromBearerOrQuery(req: Request): string | null {
  const bearer = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (bearer) return bearer;
  const raw = req.query?.access_token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  return typeof token === "string" && token.length > 0 ? token : null;
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
