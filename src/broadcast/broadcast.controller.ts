import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { BroadcastService } from "./broadcast.service";
import { BroadcastClientDto } from "./dto/broadcast-client.dto";
import { BroadcastMatchesResponseDto } from "./dto/broadcast-matches-response.dto";
import {
  PutBroadcastOverlayDto,
  CreateBroadcastOverlayLinkDto,
  BroadcastOverlayLinkResponseDto,
} from "./dto/broadcast-overlay.dto";
import { OverlaySceneResponseDto } from "../overlay/dto/overlay-scene.dto";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import type { AppRequest } from "../common/interfaces/app.interface";
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

  @Get("matches")
  @ApiOperation({
    summary: "Get broadcast client matches resolved from Host subdomain",
  })
  @ApiHeader({
    name: "host",
    description: "Subdomain host header (e.g. onesporttv.optiqsports.com)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client games retrieved successfully",
    type: BroadcastMatchesResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "GET",
    "/api/broadcast/matches",
    "Broadcast client slug could not be determined",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/matches",
    "Broadcast client not found",
  )
  getMatchesByHost(
    @Headers("host") host: string | undefined,
    @Req() req: AppRequest,
  ): Promise<BroadcastMatchesResponseDto> {
    const slug = this.broadcastService.resolveSlug(undefined, host);
    return this.broadcastService.getBroadcastMatches(slug, req.user);
  }

  @Get(":slug/matches")
  @ApiOperation({
    summary: "Get games assigned to a broadcast client by slug",
  })
  @ApiParam({
    name: "slug",
    description: "Broadcast client slug (e.g. onesporttv)",
    example: "onesporttv",
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client games retrieved successfully",
    type: BroadcastMatchesResponseDto,
  })
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/:slug/matches",
    "Broadcast client not found",
  )
  getMatchesBySlug(
    @Param("slug") slugParam: string,
    @Headers("host") host: string | undefined,
    @Req() req: AppRequest,
  ): Promise<BroadcastMatchesResponseDto> {
    const slug = this.broadcastService.resolveSlug(slugParam, host);
    return this.broadcastService.getBroadcastMatches(slug, req.user);
  }

  @Get(":slug")
  @ApiOperation({
    summary: "Get broadcast client profile by slug",
  })
  @ApiParam({
    name: "slug",
    description: "Broadcast client slug (e.g. onesporttv)",
    example: "onesporttv",
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client details retrieved successfully",
    type: BroadcastClientDto,
  })
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/:slug",
    "Broadcast client not found",
  )
  getClientBySlug(
    @Param("slug") slugParam: string,
    @Headers("host") host: string | undefined,
  ): Promise<BroadcastClientDto> {
    const slug = this.broadcastService.resolveSlug(slugParam, host);
    return this.broadcastService.getBroadcastClientBySlug(slug);
  }

  @Get()
  @ApiOperation({
    summary: "Get broadcast client profile resolved from Host subdomain",
  })
  @ApiHeader({
    name: "host",
    description: "Subdomain host header (e.g. onesporttv.optiqsports.com)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client details retrieved successfully",
    type: BroadcastClientDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "GET",
    "/api/broadcast",
    "Broadcast client slug could not be determined",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast",
    "Broadcast client not found",
  )
  getClientByHost(
    @Headers("host") host: string | undefined,
  ): Promise<BroadcastClientDto> {
    const slug = this.broadcastService.resolveSlug(undefined, host);
    return this.broadcastService.getBroadcastClientBySlug(slug);
  }
}
