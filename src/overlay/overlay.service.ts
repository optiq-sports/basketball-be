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
import { AuditLogsService } from "../audit-logs/audit-logs.service";
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
  broadcasterId?: string | null;
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
    private readonly auditLogsService: AuditLogsService,
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
    broadcasterId: string | null;
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
      broadcasterId: overlayToken.broadcasterId,
    };
  }

  /**
   * Get overlay scene state for a given client and match (optionally scoped to broadcaster).
   * If no row exists yet, returns the default blank state.
   */
  async getSceneState(
    clientId: string,
    matchId: string,
    broadcasterId?: string | null,
  ): Promise<OverlaySceneResponseDto> {
    let scene = null;

    if (broadcasterId) {
      scene = await this.prisma.overlayScene.findFirst({
        where: {
          matchId,
          broadcasterId,
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!scene) {
      scene = await this.prisma.overlayScene.findFirst({
        where: {
          matchId,
          ...(clientId ? { clientId } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
    }

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
    const { clientId, matchId, broadcasterId } =
      await this.validateOverlayToken(token);
    return this.getSceneState(clientId, matchId, broadcasterId);
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
   * Core method to save (upsert) overlay scene state for a match & broadcaster
   */
  async saveSceneState(params: {
    clientId: string;
    matchId: string;
    broadcasterId?: string | null;
    userId?: string;
    activeScene?: OverlaySceneType | string;
    payload?: Record<string, unknown>;
    visible?: boolean;
    scorebugVisible?: boolean;
    autoDismissAt?: Date | null;
  }): Promise<OverlaySceneResponseDto> {
    if (params.payload !== undefined) {
      this.validatePayload(params.payload);
    }
    if (params.activeScene !== undefined) {
      this.validateScene(params.activeScene);
    }

    const existing = await this.prisma.overlayScene.findFirst({
      where: {
        matchId: params.matchId,
        ...(params.broadcasterId
          ? { broadcasterId: params.broadcasterId }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    let scene;
    if (existing) {
      scene = await this.prisma.overlayScene.update({
        where: { id: existing.id },
        data: {
          ...(params.activeScene !== undefined && {
            activeScene: params.activeScene,
          }),
          ...(params.payload !== undefined && {
            payload: params.payload as Prisma.InputJsonValue,
          }),
          ...(params.visible !== undefined && { visible: params.visible }),
          ...(params.scorebugVisible !== undefined && {
            scorebugVisible: params.scorebugVisible,
          }),
          ...(params.autoDismissAt !== undefined && {
            autoDismissAt: params.autoDismissAt,
          }),
          ...(params.userId && { updatedByUserId: params.userId }),
        },
      });
    } else {
      scene = await this.prisma.overlayScene.create({
        data: {
          clientId: params.clientId,
          matchId: params.matchId,
          broadcasterId: params.broadcasterId ?? null,
          activeScene: params.activeScene ?? "blank",
          payload: ((params.payload as Prisma.InputJsonValue) ?? {
            v: 1,
          }) as Prisma.InputJsonValue,
          visible: params.visible ?? false,
          scorebugVisible: params.scorebugVisible ?? true,
          autoDismissAt: params.autoDismissAt ?? null,
          updatedByUserId: params.userId,
        },
      });
    }

    const response: OverlaySceneResponseDto = {
      activeScene: scene.activeScene,
      visible: scene.visible,
      scorebugVisible: scene.scorebugVisible,
      autoDismissAt: scene.autoDismissAt,
      payload: (scene.payload as Record<string, unknown>) ?? { v: 1 },
      updatedAt: scene.updatedAt,
    };

    this.broadcastUpdate(params.matchId, response, params.broadcasterId);
    return response;
  }

  /**
   * Upsert an overlay scene state from dashboard
   */
  async upsertScene(
    clientId: string,
    userId: string,
    dto: UpsertOverlaySceneDto,
  ): Promise<OverlaySceneResponseDto> {
    return this.saveSceneState({
      clientId,
      matchId: dto.matchId,
      userId,
      activeScene: dto.activeScene,
      payload: dto.payload,
      visible: dto.visible,
      scorebugVisible: dto.scorebugVisible,
      autoDismissAt: dto.autoDismissAt,
    });
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
    return this.saveSceneState({
      clientId,
      matchId,
      userId,
      activeScene: dto.activeScene,
      payload: dto.payload,
      visible: dto.visible,
      scorebugVisible: dto.scorebugVisible,
      autoDismissAt: dto.autoDismissAt,
    });
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
   * Issue or reissue an overlay token for a match and broadcaster
   */
  async issueOverlayToken(params: {
    clientId: string;
    matchId: string;
    broadcasterId?: string | null;
    actorUserId: string;
    actorRole: string;
    expiresInHours?: number;
  }): Promise<{
    token: string;
    tokenPrefix: string;
    expiresAt: Date;
    outputUrl: string;
  }> {
    const expiresInHours = Math.min(
      Math.max(params.expiresInHours ?? 24, 1),
      168,
    );
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);
    const rawKey = crypto.randomBytes(32).toString("hex");
    const token = `ovl_${rawKey}`;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const tokenPrefix = `ovl_${rawKey.slice(0, 8)}...`;

    await this.prisma.$transaction(async (tx) => {
      // Reissue: invalidate previous active overlay tokens for this match & broadcaster
      await tx.clientOverlayToken.updateMany({
        where: {
          matchId: params.matchId,
          ...(params.broadcasterId
            ? { broadcasterId: params.broadcasterId }
            : {}),
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });

      const created = await tx.clientOverlayToken.create({
        data: {
          clientId: params.clientId,
          matchId: params.matchId,
          broadcasterId: params.broadcasterId ?? null,
          tokenHash,
          tokenPrefix,
          expiresAt,
          isActive: true,
        },
      });

      await this.auditLogsService.recordLog(tx, {
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        clientId: params.clientId,
        action: "CREATE_OVERLAY_TOKEN",
        entityType: "client_overlay_token",
        entityId: created.id,
        after: {
          id: created.id,
          matchId: created.matchId,
          broadcasterId: created.broadcasterId,
          expiresAt: created.expiresAt,
        },
      });
    });

    const baseUrl =
      process.env.OVERLAY_BASE_URL ||
      "https://broadcast.optiqsports.com/overlay";
    const outputUrl = `${baseUrl.replace(/\/$/, "")}/${token}`;

    return {
      token,
      tokenPrefix,
      expiresAt,
      outputUrl,
    };
  }

  /**
   * Revoke overlay token(s) for a match and broadcaster
   */
  async revokeOverlayToken(params: {
    clientId: string;
    matchId: string;
    broadcasterId?: string | null;
    actorUserId: string;
    actorRole: string;
  }): Promise<{ success: boolean; message: string }> {
    await this.prisma.$transaction(async (tx) => {
      await tx.clientOverlayToken.updateMany({
        where: {
          matchId: params.matchId,
          ...(params.broadcasterId
            ? { broadcasterId: params.broadcasterId }
            : {}),
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });

      await this.auditLogsService.recordLog(tx, {
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        clientId: params.clientId,
        action: "REVOKE_OVERLAY_TOKEN",
        entityType: "client_overlay_token",
        entityId: `${params.matchId}_${params.broadcasterId ?? "all"}`,
        after: {
          matchId: params.matchId,
          broadcasterId: params.broadcasterId,
          revokedAt: new Date(),
        },
      });
    });

    return {
      success: true,
      message: "Overlay link revoked successfully",
    };
  }

  /**
   * Subscribe to real-time SSE stream using URL token
   */
  async getStream(
    token: string,
    heartbeatIntervalMs = 15000,
  ): Promise<Observable<MessageEvent>> {
    const { clientId, matchId, broadcasterId } =
      await this.validateOverlayToken(token);

    // Initial replay of current state
    const currentState = await this.getSceneState(
      clientId,
      matchId,
      broadcasterId,
    );
    const initial$ = of<MessageEvent>({
      type: "overlay",
      data: currentState,
    });

    // Live updates for this match and broadcaster
    const live$ = this.updates$.pipe(
      filter((update) => {
        if (update.matchId !== matchId) return false;
        if (
          broadcasterId &&
          update.broadcasterId &&
          update.broadcasterId !== broadcasterId
        ) {
          return false;
        }
        return true;
      }),
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
  private broadcastUpdate(
    matchId: string,
    state: OverlaySceneResponseDto,
    broadcasterId?: string | null,
  ) {
    const update: OverlayBroadcastUpdate = {
      matchId,
      broadcasterId,
      state,
      originNodeId: this.nodeId,
    };
    this.updates$.next(update);
    void this.redisService.publishOverlayUpdate(update);
  }
}
