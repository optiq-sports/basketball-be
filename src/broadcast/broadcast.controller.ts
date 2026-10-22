import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { BroadcastService } from "./broadcast.service";
import {
  PutBroadcastOverlayDto,
  CreateBroadcastOverlayLinkDto,
  BroadcastOverlayLinkResponseDto,
  ActiveBroadcastOverlayLinkResponseDto,
} from "./dto/broadcast-overlay.dto";
import { OverlaySceneResponseDto } from "../overlay/dto/overlay-scene.dto";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Role } from "@prisma/client";

@ApiTags("Broadcast")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.BROADCASTER)
@Controller("broadcast")
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get("matches/:matchId/overlay")
  @ApiOperation({
    summary: "Get current overlay scene state for a match",
    description:
      "Fetches the active scene, visible flags, autoDismiss timestamp, and finished graphic payload for an assigned match. Broadcasters see their own overlay; Admins see the match's overlay.",
  })
  @ApiParam({
    name: "matchId",
    description: "Match ID",
    example: "cmvdsfu3x0007l006phgl1etr",
  })
  @ApiQuery({
    name: "broadcasterId",
    required: false,
    description:
      "Target broadcaster user ID (only for ADMIN or SUPER_ADMIN users)",
  })
  @ApiResponse({
    status: 200,
    description: "Current overlay scene state",
    type: OverlaySceneResponseDto,
  })
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/api/broadcast/matches/:matchId/overlay",
    "Client users or unassigned users cannot access broadcast overlays",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/matches/:matchId/overlay",
    "Match not found or not assigned to the broadcaster",
  )
  getOverlay(
    @Param("matchId") matchId: string,
    @Query("broadcasterId") broadcasterId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OverlaySceneResponseDto> {
    return this.broadcastService.getOverlayState(user, matchId, broadcasterId);
  }

  @Put("matches/:matchId/overlay")
  @ApiOperation({
    summary: "Update overlay scene state for a match",
    description:
      "Replaces the graphic scene, master visibility, scorebug visibility, and opaque graphic payload (<= 32 KB, payload.v === 1). Immediately broadcasts to live overlay SSE subscribers.",
  })
  @ApiParam({
    name: "matchId",
    description: "Match ID",
    example: "cmvdsfu3x0007l006phgl1etr",
  })
  @ApiResponse({
    status: 200,
    description: "Updated overlay scene state",
    type: OverlaySceneResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PUT",
    "/api/broadcast/matches/:matchId/overlay",
    "Invalid scene name or payload validation failure (exceeds 32KB or missing v: 1)",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "PUT",
    "/api/broadcast/matches/:matchId/overlay",
    "Client users or unassigned users cannot update overlay state",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PUT",
    "/api/broadcast/matches/:matchId/overlay",
    "Match not found or not assigned to the broadcaster",
  )
  updateOverlay(
    @Param("matchId") matchId: string,
    @Body() dto: PutBroadcastOverlayDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OverlaySceneResponseDto> {
    return this.broadcastService.updateOverlayState(user, matchId, dto);
  }

  @Post("matches/:matchId/overlay-link")
  @ApiOperation({
    summary: "Issue or reissue an overlay token URL for OBS / vMix",
    description:
      "Generates an unguessable overlay token valid for hours, revoking any previous active token for this match and broadcaster.",
  })
  @ApiParam({
    name: "matchId",
    description: "Match ID",
    example: "cmvdsfu3x0007l006phgl1etr",
  })
  @ApiResponse({
    status: 201,
    description: "Overlay token and output URL issued successfully",
    type: BroadcastOverlayLinkResponseDto,
  })
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/api/broadcast/matches/:matchId/overlay-link",
    "Client users or unassigned users cannot issue overlay links",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/broadcast/matches/:matchId/overlay-link",
    "Match not found or not assigned to the broadcaster",
  )
  createOverlayLink(
    @Param("matchId") matchId: string,
    @Body() dto: CreateBroadcastOverlayLinkDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BroadcastOverlayLinkResponseDto> {
    return this.broadcastService.createOverlayLink(user, matchId, dto);
  }

  @Delete("matches/:matchId/overlay-link")
  @ApiOperation({
    summary: "Revoke active overlay token/link for a match",
    description:
      "Revokes the active overlay token for this match and broadcaster. The output URL immediately ceases to update and retries return 401.",
  })
  @ApiParam({
    name: "matchId",
    description: "Match ID",
    example: "cmvdsfu3x0007l006phgl1etr",
  })
  @ApiQuery({
    name: "broadcasterId",
    required: false,
    description: "Target broadcaster user ID (for ADMIN or SUPER_ADMIN users)",
  })
  @ApiResponse({
    status: 200,
    description: "Overlay link successfully revoked",
  })
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/api/broadcast/matches/:matchId/overlay-link",
    "Client users or unassigned users cannot revoke overlay links",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/api/broadcast/matches/:matchId/overlay-link",
    "Match not found or not assigned to the broadcaster",
  )
  revokeOverlayLink(
    @Param("matchId") matchId: string,
    @Query("broadcasterId") broadcasterId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    return this.broadcastService.revokeOverlayLink(
      user,
      matchId,
      broadcasterId,
    );
  }

  @Get("matches/:matchId/overlay-link")
  @ApiOperation({
    summary: "Get active overlay token metadata for a match",
    description:
      "Returns the masked token prefix and expiry of the active overlay link for this match and broadcaster without exposing the raw secret token. Returns 404 if no link exists.",
  })
  @ApiParam({
    name: "matchId",
    description: "Match ID",
    example: "cmvdsfu3x0007l006phgl1etr",
  })
  @ApiQuery({
    name: "broadcasterId",
    required: false,
    description: "Target broadcaster user ID (for ADMIN or SUPER_ADMIN users)",
  })
  @ApiResponse({
    status: 200,
    description: "Active overlay link metadata",
    type: ActiveBroadcastOverlayLinkResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "GET",
    "/api/broadcast/matches/:matchId/overlay-link",
    "A broadcaster must be assigned to this match or specified via broadcasterId",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/api/broadcast/matches/:matchId/overlay-link",
    "Client users or unassigned users cannot access overlay links",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/matches/:matchId/overlay-link",
    "Match not found or no active overlay link found",
  )
  getOverlayLink(
    @Param("matchId") matchId: string,
    @Query("broadcasterId") broadcasterId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActiveBroadcastOverlayLinkResponseDto> {
    return this.broadcastService.getOverlayLink(user, matchId, broadcasterId);
  }
}
