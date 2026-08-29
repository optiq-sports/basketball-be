import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Put,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiConsumes, ApiQuery } from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import { PlayersService } from "./players.service";
import { CreatePlayerDto } from "./dto/create-player.dto";
import { CreatePlayerForTeamDto } from "./dto/create-player-for-team.dto";
import { BulkCreatePlayersForTeamDto } from "./dto/bulk-create-players-for-team.dto";
import { UpdatePlayerDto } from "./dto/update-player.dto";
import { PlayerResponseDto, BulkCreatePlayersResponseDto } from "./dto/player-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

@ApiTags("Players")
@ApiBearerAuth()
@Controller("players")
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) { }

  /**
   * Create a standalone player (not assigned to any team)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Create a standalone player" })
  @ApiBody({ type: CreatePlayerDto, description: "Payload structure required to spin up a new player profile.", examples: { default: { value: CreatePlayerDto } } })
  @ApiResponse({ status: 201, description: "Player created successfully", type: PlayerResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/players", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/players", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/players", "Requires ADMIN or STATISTICIAN role")
  create(@Body() createPlayerDto: CreatePlayerDto) {
    return this.playersService.create(createPlayerDto);
  }

  /**
   * Create a player and assign to a team (with deduplication)
   */
  @Post("team")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Create a player and assign to a team" })
  @ApiBody({ type: CreatePlayerForTeamDto })
  @ApiResponse({ status: 201, description: "Player created and assigned successfully", type: PlayerResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/players/team", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/players/team", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/players/team", "Requires ADMIN or STATISTICIAN role")
  createForTeam(@Body() createPlayerDto: CreatePlayerForTeamDto) {
    return this.playersService.createForTeam(createPlayerDto);
  }

  /**
   * Bulk create players for a team (with deduplication)
   * This is the main endpoint for importing players
   */
  @Post("team/bulk")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Bulk create players for a team" })
  @ApiBody({ type: BulkCreatePlayersForTeamDto })
  @ApiResponse({ status: 201, description: "Players created successfully", type: BulkCreatePlayersResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/players/team/bulk", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/players/team/bulk", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/players/team/bulk", "Requires ADMIN or STATISTICIAN role")
  bulkCreateForTeam(@Body() bulkDto: BulkCreatePlayersForTeamDto) {
    return this.playersService.bulkCreateForTeam(bulkDto);
  }

  /**
   * Upload players via Excel/CSV
   */
  @Post("team/:teamId/upload")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload players via Excel or CSV" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Players uploaded successfully", type: BulkCreatePlayersResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/players/team/:teamId/upload", "Invalid file format")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/players/team/:teamId/upload", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/players/team/:teamId/upload", "Requires ADMIN or STATISTICIAN role")
  uploadPlayers(
    @Param("teamId") teamId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.playersService.processBulkUpload(teamId, file);
  }

  /**
   * Get all players (optionally filtered by team or unassigned)
   */
  @Get()
  @ApiOperation({ summary: "Get all players" })
  @ApiQuery({ name: "teamId", required: false, type: String })
  @ApiQuery({ name: "unassigned", required: false, type: String, description: "Set to 'true' to get unassigned players" })
  @ApiResponse({ status: 200, description: "Players fetched successfully", type: [PlayerResponseDto] })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/players", "Invalid or missing access token")
  findAll(
    @Query("teamId") teamId?: string,
    @Query("unassigned") unassigned?: string,
  ) {
    return this.playersService.findAll(teamId, unassigned === "true");
  }

  /**
   * Get player by ID
   */
  @Get(":id")
  @ApiOperation({ summary: "Get player by ID" })
  @ApiResponse({ status: 200, description: "Player fetched successfully", type: PlayerResponseDto })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/players/:id", "Invalid or missing access token")
  @AppErrorResponse(404, "Not Found", "GET", "/api/players/:id", "Player not found")
  findOne(@Param("id") id: string) {
    return this.playersService.findOne(id);
  }

  /**
   * Update player
   */
  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Update player details" })
  @ApiBody({ type: UpdatePlayerDto })
  @ApiResponse({ status: 200, description: "Player updated successfully", type: PlayerResponseDto })
  @AppErrorResponse(400, "Bad Request", "PATCH", "/api/players/:id", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "PATCH", "/api/players/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PATCH", "/api/players/:id", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "PATCH", "/api/players/:id", "Player not found")
  update(@Param("id") id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
    return this.playersService.update(id, updatePlayerDto);
  }

  /**
   * Assign player to team
   */
  @Put(":id/teams/:teamId")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Assign a player to a team" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { jerseyNumber: { type: "number", example: 23 } },
    },
  })
  @ApiResponse({ status: 200, description: "Player assigned successfully", type: PlayerResponseDto })
  @AppErrorResponse(400, "Bad Request", "PUT", "/api/players/:id/teams/:teamId", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "PUT", "/api/players/:id/teams/:teamId", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PUT", "/api/players/:id/teams/:teamId", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "PUT", "/api/players/:id/teams/:teamId", "Player or Team not found")
  assignToTeam(
    @Param("id") playerId: string,
    @Param("teamId") teamId: string,
    @Body("jerseyNumber") jerseyNumber: number,
  ) {
    return this.playersService.assignToTeam(playerId, teamId, jerseyNumber);
  }

  /**
   * Remove player from team
   */
  @Delete(":id/teams/:teamId")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Remove player from a team" })
  @ApiResponse({ status: 200, description: "Player removed from team successfully" })
  @AppErrorResponse(401, "Unauthorized", "DELETE", "/api/players/:id/teams/:teamId", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "DELETE", "/api/players/:id/teams/:teamId", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "DELETE", "/api/players/:id/teams/:teamId", "Player or Team not found")
  removeFromTeam(
    @Param("id") playerId: string,
    @Param("teamId") teamId: string,
  ) {
    return this.playersService.removeFromTeam(playerId, teamId);
  }

  /**
   * Remove player (deactivates all team associations)
   */
  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Delete a player (deactivates associations)" })
  @ApiResponse({ status: 200, description: "Player removed successfully" })
  @AppErrorResponse(401, "Unauthorized", "DELETE", "/api/players/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "DELETE", "/api/players/:id", "Requires ADMIN role")
  @AppErrorResponse(404, "Not Found", "DELETE", "/api/players/:id", "Player not found")
  remove(@Param("id") id: string) {
    return this.playersService.remove(id);
  }

  /**
   * Merge two player profiles
   */
  @Post("merge")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Merge two player profiles" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        duplicatePlayerId: { type: "string", example: "player-id-1" },
        targetPlayerId: { type: "string", example: "player-id-2" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Players merged successfully", type: PlayerResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/players/merge", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/players/merge", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/players/merge", "Requires ADMIN role")
  @AppErrorResponse(404, "Not Found", "POST", "/api/players/merge", "One or both players not found")
  mergePlayers(
    @Body() data: { duplicatePlayerId: string; targetPlayerId: string },
  ) {
    return this.playersService.mergePlayers(
      data.duplicatePlayerId,
      data.targetPlayerId,
    );
  }
}
