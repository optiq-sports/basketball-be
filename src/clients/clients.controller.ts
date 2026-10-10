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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
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
} from "./dto/client-response.dto";
import { ApiPaginatedResponse } from "src/common/decorators/api-paginated-response.decorator";
import { AppRequest } from "src/common/interfaces/app.interface";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "src/common/interfaces/user.interface";

@ApiTags("Clients (Internal Administration)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.CLIENT) // Allows ADMIN, CLIENT, and SUPER_ADMIN (since SUPER_ADMIN bypasses roles check)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

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
  listClients(@Query() paginationQuery: PaginationQueryDto) {
    return this.clientsService.listClients(paginationQuery);
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
    @Param("clientId") clientId: string,
    @Body() assignUserDto: AssignUserDto,
  ) {
    return this.clientsService.assignUserToClient(clientId, assignUserDto);
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
  updateClient(@Param("id") id: string, @Body() body: any) {
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
  deleteClient(@Param("id") id: string) {
    return this.clientsService.deleteClient(id);
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
}
