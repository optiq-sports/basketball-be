import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OverlayService } from "../overlay/overlay.service";
import { BroadcastClientDto } from "./dto/broadcast-client.dto";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { MatchResponseDto } from "../matches/dto/match-response.dto";
import { Role } from "@prisma/client";
import {
  PutBroadcastOverlayDto,
  CreateBroadcastOverlayLinkDto,
  BroadcastOverlayLinkResponseDto,
} from "./dto/broadcast-overlay.dto";
import { OverlaySceneResponseDto } from "../overlay/dto/overlay-scene.dto";

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly overlayService: OverlayService,
  ) {}

  resolveSlug(slugOrParam?: string, hostHeader?: string): string {
    if (slugOrParam && slugOrParam !== "matches") {
      return slugOrParam.toLowerCase().trim();
    }
    if (hostHeader) {
      // Handles hostname like "onesporttv.optiqsports.com" or "onesporttv.localhost"
      const hostname = hostHeader.split(":")[0];
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        const subdomain = parts[0].toLowerCase().trim();
        const reserved = new Set(["www", "api", "app", "localhost", "admin"]);
        if (!reserved.has(subdomain)) {
          return subdomain;
        }
      }
    }
    if (slugOrParam === "matches") {
      throw new BadRequestException(
        "Broadcast client slug must be specified in the path or subdomain",
      );
    }
    throw new BadRequestException(
      "Broadcast client slug could not be determined from path or hostname",
    );
  }

  async getBroadcastClientBySlug(slug: string): Promise<BroadcastClientDto> {
    const normalizedSlug = slug.toLowerCase().trim();
    const client = await this.prisma.client.findFirst({
      where: {
        slug: normalizedSlug,
        clientType: "broadcast",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        clientType: true,
        websiteUrl: true,
        logo: true,
      },
    });

    if (!client || !client.slug) {
      throw new NotFoundException(
        `Broadcast client '${normalizedSlug}' not found`,
      );
    }

    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
      clientType: client.clientType,
      websiteUrl: client.websiteUrl,
      logo: client.logo,
    };
  }

  async getBroadcastMatches(
    slug: string,
    user?: { role?: string; clientIds?: string[] },
  ): Promise<{ client: BroadcastClientDto; matches: MatchResponseDto[] }> {
    const client = await this.getBroadcastClientBySlug(slug);

    if (
      user &&
      user.role === "CLIENT" &&
      user.clientIds &&
      !user.clientIds.includes(client.id)
    ) {
      return {
        client,
        matches: [],
      };
    }

    const matches = await this.prisma.match.findMany({
      where: {
        clientId: client.id,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: true,
        statistician: true,
        broadcasters: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        gameSessions: {
          select: {
            id: true,
            status: true,
            quarter: true,
            clockSecondsRemaining: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: {
        scheduledDate: "asc",
      },
    });

    return {
      client,
      matches: matches as unknown as MatchResponseDto[],
    };
  }

  /**
   * Validate match access for broadcast operations:
   * - CLIENT: 403 Forbidden on all broadcast routes
   * - BROADCASTER: must be assigned to the match via MatchBroadcaster (404 otherwise)
   * - ADMIN: must belong to the client managing this match
   * - SUPER_ADMIN: unrestricted
   */
  async checkBroadcastMatchAccess(
    user: AuthenticatedUser,
    matchId: string,
    explicitBroadcasterId?: string,
  ): Promise<{
    match: { id: string; clientId: string };
    resolvedBroadcasterId: string | null;
  }> {
    if (user.role === Role.CLIENT) {
      throw new ForbiddenException(
        "Client users do not have access to broadcast endpoints",
      );
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        broadcasters: {
          select: { userId: true },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match '${matchId}' not found`);
    }

    let resolvedBroadcasterId: string | null = null;

    if (user.role === Role.BROADCASTER) {
      const isAssigned = match.broadcasters.some((b) => b.userId === user.id);
      if (!isAssigned) {
        throw new NotFoundException(`Match '${matchId}' not found`);
      }
      resolvedBroadcasterId = user.id;
    } else if (user.role === Role.ADMIN) {
      if (user.clientIds && !user.clientIds.includes(match.clientId)) {
        throw new ForbiddenException(
          "You do not have access to matches for this client",
        );
      }
      resolvedBroadcasterId =
        explicitBroadcasterId || match.broadcasters[0]?.userId || null;
    } else if (user.role === Role.SUPER_ADMIN) {
      resolvedBroadcasterId =
        explicitBroadcasterId || match.broadcasters[0]?.userId || null;
    } else {
      throw new ForbiddenException(
        "Insufficient permissions to access broadcast match",
      );
    }

    return { match, resolvedBroadcasterId };
  }

  /**
   * GET /broadcast/matches/:matchId/overlay
   */
  async getOverlayState(
    user: AuthenticatedUser,
    matchId: string,
    broadcasterId?: string,
  ): Promise<OverlaySceneResponseDto> {
    const { match, resolvedBroadcasterId } =
      await this.checkBroadcastMatchAccess(user, matchId, broadcasterId);
    return this.overlayService.getSceneState(
      match.clientId,
      matchId,
      resolvedBroadcasterId,
    );
  }

  /**
   * PUT /broadcast/matches/:matchId/overlay
   */
  async updateOverlayState(
    user: AuthenticatedUser,
    matchId: string,
    dto: PutBroadcastOverlayDto,
  ): Promise<OverlaySceneResponseDto> {
    const { match, resolvedBroadcasterId } =
      await this.checkBroadcastMatchAccess(user, matchId, dto.broadcasterId);
    return this.overlayService.saveSceneState({
      clientId: match.clientId,
      matchId,
      broadcasterId: resolvedBroadcasterId,
      userId: user.id,
      activeScene: dto.activeScene,
      payload: dto.payload,
      visible: dto.visible,
      scorebugVisible: dto.scorebugVisible,
      autoDismissAt: dto.autoDismissAt,
    });
  }

  /**
   * POST /broadcast/matches/:matchId/overlay-link
   */
  async createOverlayLink(
    user: AuthenticatedUser,
    matchId: string,
    dto: CreateBroadcastOverlayLinkDto,
  ): Promise<BroadcastOverlayLinkResponseDto> {
    const { match, resolvedBroadcasterId } =
      await this.checkBroadcastMatchAccess(user, matchId, dto.broadcasterId);
    return this.overlayService.issueOverlayToken({
      clientId: match.clientId,
      matchId,
      broadcasterId: resolvedBroadcasterId,
      actorUserId: user.id,
      actorRole: user.role,
      expiresInHours: dto.expiresInHours,
    });
  }

  /**
   * DELETE /broadcast/matches/:matchId/overlay-link
   */
  async revokeOverlayLink(
    user: AuthenticatedUser,
    matchId: string,
    broadcasterId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const { match, resolvedBroadcasterId } =
      await this.checkBroadcastMatchAccess(user, matchId, broadcasterId);
    return this.overlayService.revokeOverlayToken({
      clientId: match.clientId,
      matchId,
      broadcasterId: resolvedBroadcasterId,
      actorUserId: user.id,
      actorRole: user.role,
    });
  }
}
