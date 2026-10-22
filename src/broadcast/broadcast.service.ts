import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OverlayService } from "../overlay/overlay.service";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
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

  /**
   * Validate match access for broadcast operations:
   * - CLIENT: 403 Forbidden on all broadcast routes
   * - BROADCASTER: must be assigned to the match via MatchBroadcaster (404 otherwise)
   * - ADMIN: must belong to the client managing this match
   * - SUPER_ADMIN: unrestricted
   * - Broadcaster is required: returns 400 if none can be resolved
   * - If broadcasterId is specified by Admin/SuperAdmin, checks that the broadcaster is assigned to the match
   */
  async checkBroadcastMatchAccess(
    user: AuthenticatedUser,
    matchId: string,
    explicitBroadcasterId?: string,
  ): Promise<{
    match: { id: string; clientId: string };
    resolvedBroadcasterId: string;
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
      if (explicitBroadcasterId) {
        const isAssigned = match.broadcasters.some(
          (b) => b.userId === explicitBroadcasterId,
        );
        if (!isAssigned) {
          throw new BadRequestException(
            `Broadcaster '${explicitBroadcasterId}' is not assigned to match '${matchId}'`,
          );
        }
        resolvedBroadcasterId = explicitBroadcasterId;
      } else {
        resolvedBroadcasterId = match.broadcasters[0]?.userId || null;
      }
    } else if (user.role === Role.SUPER_ADMIN) {
      if (explicitBroadcasterId) {
        const isAssigned = match.broadcasters.some(
          (b) => b.userId === explicitBroadcasterId,
        );
        if (!isAssigned) {
          throw new BadRequestException(
            `Broadcaster '${explicitBroadcasterId}' is not assigned to match '${matchId}'`,
          );
        }
        resolvedBroadcasterId = explicitBroadcasterId;
      } else {
        resolvedBroadcasterId = match.broadcasters[0]?.userId || null;
      }
    } else {
      throw new ForbiddenException(
        "Insufficient permissions to access broadcast match",
      );
    }

    if (!resolvedBroadcasterId) {
      throw new BadRequestException(
        "A broadcaster must be assigned to this match or specified via broadcasterId",
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

  /**
   * GET /broadcast/matches/:matchId/overlay-link
   */
  async getOverlayLink(
    user: AuthenticatedUser,
    matchId: string,
    broadcasterId?: string,
  ): Promise<{ tokenPrefix: string; expiresAt: Date }> {
    const { match, resolvedBroadcasterId } =
      await this.checkBroadcastMatchAccess(user, matchId, broadcasterId);
    return this.overlayService.getActiveOverlayLink(
      match.clientId,
      matchId,
      resolvedBroadcasterId,
    );
  }
}
