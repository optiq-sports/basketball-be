import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CreateEmbedTokenDto } from "./dto/create-embed-token.dto";
import { CreateOverlayTokenDto } from "./dto/create-overlay-token.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role, Prisma } from "@prisma/client";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from "@nestjs/swagger";
import { CreateClientDto } from "./dto/create-client.dto";
import { AssignUserDto } from "./dto/assign-user.dto";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import {
  ClientResponseDto,
  ClientApiKeyResponseDto,
  MyClientResponseDto,
  ClientUserResponseDto,
  ClientEmbedTokenResponseDto,
  ClientOverlayTokenResponseDto,
} from "./dto/client-response.dto";
import { ClientFilterDto } from "./dto/client-filter.dto";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { AppRequest } from "src/common/interfaces/app.interface";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "src/common/interfaces/user.interface";
import {
  UpsertOverlaySceneDto,
  PatchOverlaySceneDto,
  OverlaySceneResponseDto,
} from "../overlay/dto/overlay-scene.dto";

@ApiTags("Clients (Internal Administration)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.CLIENT) // Allows ADMIN, CLIENT, and SUPER_ADMIN (since SUPER_ADMIN bypasses roles check)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get("me")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Get current client organisation details" })
  @ApiResponse({
    status: 200,
    description: "Returns client organisation details",
    type: MyClientResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/me",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/me",
    "User is not assigned to any client",
  )
  @AppErrorResponse(404, "Not Found", "GET", "/clients/me", "Client not found")
  getMyClient(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.getMyClient(user);
  }

  @Get("me/api-keys")
  @ApiOperation({ summary: "List API keys for the currently logged in CLIENT" })
  @ApiResponse({
    status: 200,
    description: "Returns a list of API keys",
    type: [ClientApiKeyResponseDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/me/api-keys",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/me/api-keys",
    "Requires CLIENT role or client assignment",
  )
  listMyApiKeys(@CurrentUser() user: AuthenticatedUser) {
    // If they have multiple clients assigned, default to the first one
    const clientId = user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }
    return this.clientsService.listApiKeys(user, clientId);
  }

  @Post("me/api-keys")
  @ApiOperation({
    summary: "Create an API key for the currently logged in CLIENT",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "API Key successfully created",
    type: ClientApiKeyResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/clients/me/api-keys",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients/me/api-keys",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients/me/api-keys",
    "Requires CLIENT role or client assignment",
  )
  createMyApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name: string },
  ) {
    const clientId = user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }
    return this.clientsService.createApiKey(user, {
      clientId,
      name: body.name,
    });
  }

  @Post("api-keys")
  @ApiOperation({ summary: "Create a new API key for a client" })
  @ApiBody({ type: CreateApiKeyDto })
  @ApiResponse({
    status: 201,
    description: "API Key successfully created",
    type: ClientApiKeyResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/clients/api-keys",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients/api-keys",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients/api-keys",
    "Not authorized for this client",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/clients/api-keys",
    "Client not found",
  )
  createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    return this.clientsService.createApiKey(user, createApiKeyDto);
  }

  @Get(":clientId/api-keys")
  @ApiOperation({ summary: "List all API keys for a client" })
  @ApiResponse({
    status: 200,
    description: "Returns a list of API keys",
    type: [ClientApiKeyResponseDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/:clientId/api-keys",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/:clientId/api-keys",
    "Not authorized for this client",
  )
  listApiKeys(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
  ) {
    return this.clientsService.listApiKeys(user, clientId);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "List all clients (SUPER_ADMIN only)" })
  @ApiPaginatedResponse(ClientResponseDto)
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients",
    "Requires SUPER_ADMIN role",
  )
  listClients(@Query() filterDto: ClientFilterDto) {
    return this.clientsService.listClients(filterDto);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a new client (SUPER_ADMIN only)" })
  @ApiBody({ type: CreateClientDto })
  @ApiResponse({
    status: 201,
    description: "Client successfully created",
    type: ClientResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/clients",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients",
    "Requires SUPER_ADMIN role",
  )
  createClient(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.createClient(createClientDto);
  }

  @Get(":clientId/users")
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: "List users linked to a client (SUPER_ADMIN or ADMIN only)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns list of users linked to the client",
    type: [ClientUserResponseDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/:clientId/users",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/:clientId/users",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/clients/:clientId/users",
    "Client not found",
  )
  listClientUsers(@Param("clientId") clientId: string) {
    return this.clientsService.listClientUsers(clientId);
  }

  @Delete(":clientId/users/:userId")
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: "Unlink a user from a client (SUPER_ADMIN or ADMIN only)",
  })
  @ApiResponse({
    status: 200,
    description: "User unlinked from client successfully",
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/clients/:clientId/users/:userId",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/clients/:clientId/users/:userId",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/clients/:clientId/users/:userId",
    "Client or User not found",
  )
  unlinkUserFromClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Param("userId") userId: string,
  ) {
    return this.clientsService.unlinkUserFromClient(clientId, userId, user);
  }

  @Post(":clientId/users")
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: "Assign a user to a client (SUPER_ADMIN or ADMIN only)",
  })
  @ApiBody({ type: AssignUserDto })
  @ApiResponse({
    status: 201,
    description: "User assigned to client successfully",
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/clients/:clientId/users",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients/:clientId/users",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients/:clientId/users",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/clients/:clientId/users",
    "Client or User not found",
  )
  assignUserToClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Body() assignUserDto: AssignUserDto,
  ) {
    return this.clientsService.assignUserToClient(
      clientId,
      assignUserDto,
      user,
    );
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: "Update a client properties (SUPER_ADMIN or ADMIN only)",
  })
  @ApiResponse({ status: 200, description: "Client successfully updated" })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PATCH",
    "/clients/:id",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "PATCH",
    "/clients/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "PATCH",
    "/clients/:id",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PATCH",
    "/clients/:id",
    "Client not found",
  )
  updateClient(
    @Param("id") id: string,
    @Body() body: Prisma.ClientUpdateInput,
  ) {
    return this.clientsService.updateClient(id, body);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Deactivate a client (SUPER_ADMIN or ADMIN only)" })
  @ApiResponse({ status: 200, description: "Client successfully deactivated" })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/clients/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/clients/:id",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/clients/:id",
    "Client not found",
  )
  deleteClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.clientsService.deleteClient(id, user);
  }

  @Delete("api-keys/:id")
  @ApiOperation({ summary: "Revoke an API key" })
  @ApiResponse({ status: 200, description: "API Key successfully revoked" })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/clients/api-keys/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/clients/api-keys/:id",
    "Not authorized for this API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/clients/api-keys/:id",
    "API Key not found",
  )
  revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.clientsService.revokeApiKey(user, id);
  }

  // ---------------------------------------------------------------------------
  // Embed Tokens (Read-only, Origin-enforced)
  // ---------------------------------------------------------------------------

  @Get("me/embed-tokens")
  @ApiOperation({
    summary: "List embed tokens for the currently logged in CLIENT",
  })
  @ApiResponse({
    status: 200,
    description: "Returns a list of embed tokens",
    type: [ClientEmbedTokenResponseDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/me/embed-tokens",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/me/embed-tokens",
    "Requires CLIENT role or client assignment",
  )
  listMyEmbedTokens(@CurrentUser() user: AuthenticatedUser) {
    const clientId = user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }
    return this.clientsService.listEmbedTokens(user, clientId);
  }

  @Post("me/embed-tokens")
  @ApiOperation({
    summary: "Create an embed token for the currently logged in CLIENT",
  })
  @ApiBody({ type: CreateEmbedTokenDto })
  @ApiResponse({
    status: 201,
    description: "Embed token successfully created",
    type: ClientEmbedTokenResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/clients/me/embed-tokens",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients/me/embed-tokens",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients/me/embed-tokens",
    "Requires CLIENT role or client assignment",
  )
  createMyEmbedToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmbedTokenDto,
  ) {
    const clientId = user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }
    return this.clientsService.createEmbedToken(user, {
      ...dto,
      clientId,
    });
  }

  @Get(":clientId/embed-tokens")
  @ApiOperation({ summary: "List all embed tokens for a client" })
  @ApiResponse({
    status: 200,
    description: "Returns a list of embed tokens",
    type: [ClientEmbedTokenResponseDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/:clientId/embed-tokens",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/:clientId/embed-tokens",
    "Not authorized for this client",
  )
  listEmbedTokens(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
  ) {
    return this.clientsService.listEmbedTokens(user, clientId);
  }

  @Post(":clientId/embed-tokens")
  @ApiOperation({ summary: "Create an embed token for a client" })
  @ApiBody({ type: CreateEmbedTokenDto })
  @ApiResponse({
    status: 201,
    description: "Embed token successfully created",
    type: ClientEmbedTokenResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/clients/:clientId/embed-tokens",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients/:clientId/embed-tokens",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients/:clientId/embed-tokens",
    "Not authorized for this client",
  )
  createEmbedToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Body() dto: CreateEmbedTokenDto,
  ) {
    return this.clientsService.createEmbedToken(user, {
      ...dto,
      clientId,
    });
  }

  @Delete("embed-tokens/:id")
  @ApiOperation({ summary: "Revoke an embed token" })
  @ApiResponse({
    status: 200,
    description: "Embed token successfully revoked",
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/clients/embed-tokens/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/clients/embed-tokens/:id",
    "Not authorized for this embed token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/clients/embed-tokens/:id",
    "Embed token not found",
  )
  revokeEmbedToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.clientsService.revokeEmbedToken(user, id);
  }

  // ---------------------------------------------------------------------------
  // Overlay Tokens (Scoped to match, hour-based expiry)
  // ---------------------------------------------------------------------------

  @Post("me/matches/:matchId/overlay-token")
  @ApiOperation({
    summary:
      "Generate or reissue an overlay token for a match (scoped, hour-based expiry)",
  })
  @ApiResponse({
    status: 201,
    description: "Overlay token successfully created or reissued",
    type: ClientOverlayTokenResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients/me/matches/:matchId/overlay-token",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients/me/matches/:matchId/overlay-token",
    "Requires CLIENT role or client assignment",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/clients/me/matches/:matchId/overlay-token",
    "Match not found for this client",
  )
  createMyOverlayToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("matchId") matchId: string,
    @Body() body?: { expiresInHours?: number },
  ) {
    const clientId = user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }
    return this.clientsService.createOrReissueOverlayToken(user, {
      clientId,
      matchId,
      expiresInHours: body?.expiresInHours,
    });
  }

  @Get("me/matches/:matchId/overlay-token")
  @ApiOperation({
    summary: "Get the active overlay token summary for a match",
  })
  @ApiResponse({
    status: 200,
    description: "Returns active overlay token metadata",
    type: ClientOverlayTokenResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/me/matches/:matchId/overlay-token",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/me/matches/:matchId/overlay-token",
    "Requires CLIENT role or client assignment",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/clients/me/matches/:matchId/overlay-token",
    "No active overlay token found for this match",
  )
  getMyOverlayToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("matchId") matchId: string,
  ) {
    const clientId = user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }
    return this.clientsService.getActiveOverlayToken(user, clientId, matchId);
  }

  @Post(":clientId/matches/:matchId/overlay-token")
  @ApiOperation({
    summary:
      "Generate or reissue an overlay token for a match on behalf of client",
  })
  @ApiResponse({
    status: 201,
    description: "Overlay token successfully created or reissued",
    type: ClientOverlayTokenResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/clients/:clientId/matches/:matchId/overlay-token",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/clients/:clientId/matches/:matchId/overlay-token",
    "Not authorized for this client",
  )
  createOverlayToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Param("matchId") matchId: string,
    @Body() body?: { expiresInHours?: number },
  ) {
    return this.clientsService.createOrReissueOverlayToken(user, {
      clientId,
      matchId,
      expiresInHours: body?.expiresInHours,
    });
  }

  @Get(":clientId/matches/:matchId/overlay-token")
  @ApiOperation({
    summary: "Get the active overlay token summary for a client match",
  })
  @ApiResponse({
    status: 200,
    description: "Returns active overlay token metadata",
    type: ClientOverlayTokenResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/clients/:clientId/matches/:matchId/overlay-token",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/clients/:clientId/matches/:matchId/overlay-token",
    "Not authorized for this client",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/clients/:clientId/matches/:matchId/overlay-token",
    "No active overlay token found",
  )
  getOverlayToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("clientId") clientId: string,
    @Param("matchId") matchId: string,
  ) {
    return this.clientsService.getActiveOverlayToken(user, clientId, matchId);
  }

  @Delete("overlay-tokens/:id")
  @ApiOperation({ summary: "Revoke an overlay token" })
  @ApiResponse({
    status: 200,
    description: "Overlay token successfully revoked",
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/clients/overlay-tokens/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/clients/overlay-tokens/:id",
    "Not authorized for this overlay token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/clients/overlay-tokens/:id",
    "Overlay token not found",
  )
  revokeOverlayToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.clientsService.revokeOverlayToken(user, id);
  }

  @Get("me/overlays")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({
    summary: "Get current client overlay scenes or filter by match",
  })
  @ApiResponse({
    status: 200,
    description: "Returns client overlay scene states",
    type: [OverlaySceneResponseDto],
  })
  getMyOverlays(
    @CurrentUser() user: AuthenticatedUser,
    @Query("matchId") matchId?: string,
  ) {
    return this.clientsService.getMyOverlays(user, matchId);
  }

  @Get("me/overlays/:matchId")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Get overlay scene state for a specific match" })
  @ApiResponse({
    status: 200,
    description: "Returns overlay scene state for the match",
    type: OverlaySceneResponseDto,
  })
  getMyOverlayByMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("matchId") matchId: string,
  ) {
    return this.clientsService.getMyOverlayByMatch(user, matchId);
  }

  @Post("me/overlays")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({
    summary: "Create or replace an overlay scene state for a match",
  })
  @ApiBody({ type: UpsertOverlaySceneDto })
  @ApiResponse({
    status: 201,
    description: "Overlay scene state successfully updated",
    type: OverlaySceneResponseDto,
  })
  upsertMyOverlay(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertOverlaySceneDto,
  ) {
    return this.clientsService.upsertMyOverlay(user, dto);
  }

  @Patch("me/overlays/:matchId")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({ summary: "Patch an overlay scene state for a match" })
  @ApiBody({ type: PatchOverlaySceneDto })
  @ApiResponse({
    status: 200,
    description: "Overlay scene state successfully patched",
    type: OverlaySceneResponseDto,
  })
  patchMyOverlayWithParam(
    @CurrentUser() user: AuthenticatedUser,
    @Param("matchId") matchId: string,
    @Body() dto: PatchOverlaySceneDto,
  ) {
    return this.clientsService.patchMyOverlay(user, matchId, dto);
  }

  @Patch("me/overlays")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({
    summary: "Patch an overlay scene state with matchId in body",
  })
  @ApiBody({ type: PatchOverlaySceneDto })
  @ApiResponse({
    status: 200,
    description: "Overlay scene state successfully patched",
    type: OverlaySceneResponseDto,
  })
  patchMyOverlay(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PatchOverlaySceneDto,
  ) {
    return this.clientsService.patchMyOverlay(user, dto.matchId as string, dto);
  }

  @Delete("me/overlays/:matchId")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({
    summary: "Reset overlay scene state for a match to default blank state",
  })
  @ApiResponse({
    status: 200,
    description: "Overlay scene successfully reset",
  })
  resetMyOverlayWithParam(
    @CurrentUser() user: AuthenticatedUser,
    @Param("matchId") matchId: string,
  ) {
    return this.clientsService.resetMyOverlay(user, matchId);
  }

  @Delete("me/overlays")
  @Roles(Role.ADMIN, Role.CLIENT)
  @ApiOperation({
    summary: "Reset overlay scene state for a match via query parameter",
  })
  @ApiResponse({
    status: 200,
    description: "Overlay scene successfully reset",
  })
  resetMyOverlay(
    @CurrentUser() user: AuthenticatedUser,
    @Query("matchId") matchId: string,
  ) {
    return this.clientsService.resetMyOverlay(user, matchId);
  }
}
