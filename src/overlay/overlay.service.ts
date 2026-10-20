import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { MessageEvent } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import {
  UpsertOverlaySceneDto,
  PatchOverlaySceneDto,
  OverlaySceneResponseDto,
  VALID_OVERLAY_SCENES,
  OverlaySceneType,
} from "./dto/overlay-scene.dto";
import * as crypto from "crypto";
import { Observable, concat, of, Subject, interval, merge } from "rxjs";
import { filter, map } from "rxjs/operators";
import { Prisma } from "@prisma/client";

export interface OverlayBroadcastUpdate {
  matchId: string;
  state: OverlaySceneResponseDto;
  originNodeId?: string;
}

@Injectable()
export class OverlayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OverlayService.name);
  private readonly nodeId = crypto.randomUUID();
  private readonly updates$ = new Subject<OverlayBroadcastUpdate>();
  private unsubscribeRedis?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.unsubscribeRedis = this.redisService.subscribeOverlayUpdates(
      (rawPayload: unknown) => {
        try {
          const payload = rawPayload as OverlayBroadcastUpdate;
          if (payload && payload.originNodeId !== this.nodeId) {
            this.updates$.next(payload);
          }
        } catch (error: unknown) {
          const err = error as Error;
          this.logger.warn(
            `Failed to process redis overlay update: ${err.message}`,
          );
        }
      },
    );
  }

  onModuleDestroy() {
    this.unsubscribeRedis?.();
  }

  /**
   * Validate opaque graphic payload:
   * - Must be a JSON object (not array or null)
   * - Must contain payload.v === 1
   * - Serialized size must not exceed 32 KB (32768 bytes)
   */
  validatePayload(
    payload: unknown,
  ): asserts payload is Record<string, unknown> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Payload must be a JSON object");
    }
    const record = payload as Record<string, unknown>;
    if (record.v !== 1) {
      throw new BadRequestException(
        "Payload version must be 1 (payload.v === 1)",
      );
    }
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, "utf8") > 32 * 1024) {
      throw new BadRequestException(
        "Payload size exceeds maximum allowed size of 32 KB",
      );
    }
  }

  /**
   * Validate scene string
   */
  validateScene(scene: string): asserts scene is OverlaySceneType {
    if (!VALID_OVERLAY_SCENES.includes(scene as OverlaySceneType)) {
      throw new BadRequestException(
        `Invalid scene '${scene}'. Allowed scenes: ${VALID_OVERLAY_SCENES.join(", ")}`,
      );
    }
  }

  /**
   * Validate URL overlay token from OBS/vMix browser sources
   */
  async validateOverlayToken(token: string): Promise<{
    clientId: string;
    matchId: string;
  }> {
    if (!token || typeof token !== "string") {
      throw new UnauthorizedException("Invalid overlay token");
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const overlayToken = await this.prisma.clientOverlayToken.findUnique({
      where: { tokenHash },
      include: { client: true },
    });

    if (!overlayToken) {
      throw new NotFoundException("Overlay token not found");
    }

    if (!overlayToken.isActive || overlayToken.revokedAt) {
      throw new UnauthorizedException("Overlay token has been revoked");
    }

    if (!overlayToken.client?.isActive) {
      throw new ForbiddenException("Client is inactive");
    }

    if (new Date() > overlayToken.expiresAt) {
      throw new UnauthorizedException("Overlay token has expired");
    }

    // Fire and forget updating lastUsedAt
    this.prisma.clientOverlayToken
      .update({
        where: { id: overlayToken.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err: Error) => {
        this.logger.warn(
          `Failed to update lastUsedAt for overlay token: ${err.message}`,
        );
      });

    return {
      clientId: overlayToken.clientId,
      matchId: overlayToken.matchId,
    };
  }

  /**
   * Get overlay scene state for a given client and match.
   * If no row exists yet, returns the default blank state.
   */
  async getSceneState(
    clientId: string,
    matchId: string,
  ): Promise<OverlaySceneResponseDto> {
    const scene = await this.prisma.overlayScene.findUnique({
      where: {
        clientId_matchId: {
          clientId,
          matchId,
        },
      },
    });

    if (!scene) {
      return {
        activeScene: "blank",
        visible: false,
        scorebugVisible: true,
        autoDismissAt: null,
        payload: { v: 1 },
        updatedAt: new Date(),
      };
    }

    return {
      activeScene: scene.activeScene,
      visible: scene.visible,
      scorebugVisible: scene.scorebugVisible,
      autoDismissAt: scene.autoDismissAt,
      payload: (scene.payload as Record<string, unknown>) ?? { v: 1 },
      updatedAt: scene.updatedAt,
    };
  }

  /**
   * Get overlay scene state by URL token
   */
  async getSceneByToken(token: string): Promise<OverlaySceneResponseDto> {
    const { clientId, matchId } = await this.validateOverlayToken(token);
    return this.getSceneState(clientId, matchId);
  }

  /**
   * List overlay scenes for a client (optionally filtered by matchId)
   */
  async listScenes(
    clientId: string,
    matchId?: string,
  ): Promise<OverlaySceneResponseDto[]> {
    if (matchId) {
      const single = await this.getSceneState(clientId, matchId);
      return [single];
    }

    const scenes = await this.prisma.overlayScene.findMany({
      where: { clientId },
      orderBy: { updatedAt: "desc" },
    });

    return scenes.map((s) => ({
      activeScene: s.activeScene,
      visible: s.visible,
      scorebugVisible: s.scorebugVisible,
      autoDismissAt: s.autoDismissAt,
      payload: (s.payload as Record<string, unknown>) ?? { v: 1 },
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Upsert an overlay scene state from dashboard
   */
  async upsertScene(
    clientId: string,
    userId: string,
    dto: UpsertOverlaySceneDto,
  ): Promise<OverlaySceneResponseDto> {
    if (dto.payload !== undefined) {
      this.validatePayload(dto.payload);
    }
    if (dto.activeScene !== undefined) {
      this.validateScene(dto.activeScene);
    }

    const payloadToSave = dto.payload ?? { v: 1 };

    const scene = await this.prisma.overlayScene.upsert({
      where: {
        clientId_matchId: {
          clientId,
          matchId: dto.matchId,
        },
      },
      create: {
        clientId,
        matchId: dto.matchId,
        activeScene: dto.activeScene ?? "blank",
        payload: payloadToSave as Prisma.InputJsonValue,
        visible: dto.visible ?? false,
        scorebugVisible: dto.scorebugVisible ?? true,
        autoDismissAt: dto.autoDismissAt ?? null,
        updatedByUserId: userId,
      },
      update: {
        ...(dto.activeScene !== undefined && { activeScene: dto.activeScene }),
        ...(dto.payload !== undefined && {
          payload: dto.payload as Prisma.InputJsonValue,
        }),
        ...(dto.visible !== undefined && { visible: dto.visible }),
        ...(dto.scorebugVisible !== undefined && {
          scorebugVisible: dto.scorebugVisible,
        }),
        ...(dto.autoDismissAt !== undefined && {
          autoDismissAt: dto.autoDismissAt,
        }),
        updatedByUserId: userId,
      },
    });

    const response: OverlaySceneResponseDto = {
      activeScene: scene.activeScene,
      visible: scene.visible,
      scorebugVisible: scene.scorebugVisible,
      autoDismissAt: scene.autoDismissAt,
      payload: (scene.payload as Record<string, unknown>) ?? { v: 1 },
      updatedAt: scene.updatedAt,
    };

    this.broadcastUpdate(dto.matchId, response);
    return response;
  }

  /**
   * Patch overlay scene state from dashboard
   */
  async patchScene(
    clientId: string,
    userId: string,
    matchId: string,
    dto: PatchOverlaySceneDto,
  ): Promise<OverlaySceneResponseDto> {
    if (dto.payload !== undefined) {
      this.validatePayload(dto.payload);
    }
    if (dto.activeScene !== undefined) {
      this.validateScene(dto.activeScene);
    }

    const scene = await this.prisma.overlayScene.upsert({
      where: {
        clientId_matchId: {
          clientId,
          matchId,
        },
      },
      create: {
        clientId,
        matchId,
        activeScene: dto.activeScene ?? "blank",
        payload: ((dto.payload as Prisma.InputJsonValue) ?? {
          v: 1,
        }) as Prisma.InputJsonValue,
        visible: dto.visible ?? false,
        scorebugVisible: dto.scorebugVisible ?? true,
        autoDismissAt: dto.autoDismissAt ?? null,
        updatedByUserId: userId,
      },
      update: {
        ...(dto.activeScene !== undefined && { activeScene: dto.activeScene }),
        ...(dto.payload !== undefined && {
          payload: dto.payload as Prisma.InputJsonValue,
        }),
        ...(dto.visible !== undefined && { visible: dto.visible }),
        ...(dto.scorebugVisible !== undefined && {
          scorebugVisible: dto.scorebugVisible,
        }),
        ...(dto.autoDismissAt !== undefined && {
          autoDismissAt: dto.autoDismissAt,
        }),
        updatedByUserId: userId,
      },
    });

    const response: OverlaySceneResponseDto = {
      activeScene: scene.activeScene,
      visible: scene.visible,
      scorebugVisible: scene.scorebugVisible,
      autoDismissAt: scene.autoDismissAt,
      payload: (scene.payload as Record<string, unknown>) ?? { v: 1 },
      updatedAt: scene.updatedAt,
    };

    this.broadcastUpdate(matchId, response);
    return response;
  }

  /**
   * Reset overlay scene state (DELETE /clients/me/overlays/:matchId)
   */
  async resetScene(
    clientId: string,
    _userId: string,
    matchId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.prisma.overlayScene.deleteMany({
      where: { clientId, matchId },
    });

    const resetState: OverlaySceneResponseDto = {
      activeScene: "blank",
      visible: false,
      scorebugVisible: true,
      autoDismissAt: null,
      payload: { v: 1 },
      updatedAt: new Date(),
    };

    this.broadcastUpdate(matchId, resetState);
    return {
      success: true,
      message: "Overlay scene reset to default blank state",
    };
  }

  /**
   * Subscribe to real-time SSE stream using URL token
   */
  async getStream(
    token: string,
    heartbeatIntervalMs = 15000,
  ): Promise<Observable<MessageEvent>> {
    const { clientId, matchId } = await this.validateOverlayToken(token);

    // Initial replay of current state
    const currentState = await this.getSceneState(clientId, matchId);
    const initial$ = of<MessageEvent>({
      type: "overlay",
      data: currentState,
    });

    // Live updates for this match
    const live$ = this.updates$.pipe(
      filter((update) => update.matchId === matchId),
      map((update): MessageEvent => ({
        type: "overlay",
        data: update.state,
      })),
    );

    // Heartbeat comment frame
    const heartbeat$ = interval(heartbeatIntervalMs).pipe(
      map((): MessageEvent => ({ comment: "ping" })),
    );

    return merge(concat(initial$, live$), heartbeat$);
  }

  /**
   * Broadcast state update locally and to Redis pub/sub
   */
  private broadcastUpdate(matchId: string, state: OverlaySceneResponseDto) {
    const update: OverlayBroadcastUpdate = {
      matchId,
      state,
      originNodeId: this.nodeId,
    };
    this.updates$.next(update);
    void this.redisService.publishOverlayUpdate(update);
  }
}
