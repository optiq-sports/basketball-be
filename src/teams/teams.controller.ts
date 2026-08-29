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
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiQuery } from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { TeamsService } from "./teams.service";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { SetCaptainDto } from "./dto/set-captain.dto";
import { TeamResponseDto, TeamWithPlayersResponseDto } from "./dto/team-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

@ApiTags("Teams")
@ApiBearerAuth()
@Controller("teams")
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Create a new team" })
  @ApiBody({ type: CreateTeamDto })
  @ApiResponse({ status: 201, description: "Team created successfully", type: TeamResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/teams", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/teams", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/teams", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(409, "Conflict", "POST", "/api/teams", "Team code already exists")
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all teams" })
  @ApiQuery({ name: "tournamentId", required: false, type: String, description: "Filter teams by tournament" })
  @ApiResponse({ status: 200, description: "Teams fetched successfully", type: [TeamWithPlayersResponseDto] })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/teams", "Invalid or missing access token")
  findAll(@Query("tournamentId") tournamentId?: string) {
    return this.teamsService.findAll(tournamentId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific team by ID" })
  @ApiResponse({ status: 200, description: "Team fetched successfully", type: TeamWithPlayersResponseDto })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/teams/:id", "Invalid or missing access token")
  @AppErrorResponse(404, "Not Found", "GET", "/api/teams/:id", "Team not found")
  findOne(@Param("id") id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Update team details" })
  @ApiBody({ type: UpdateTeamDto })
  @ApiResponse({ status: 200, description: "Team updated successfully", type: TeamResponseDto })
  @AppErrorResponse(400, "Bad Request", "PATCH", "/api/teams/:id", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "PATCH", "/api/teams/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PATCH", "/api/teams/:id", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "PATCH", "/api/teams/:id", "Team not found")
  @AppErrorResponse(409, "Conflict", "PATCH", "/api/teams/:id", "Team code already exists")
  update(@Param("id") id: string, @Body() updateTeamDto: UpdateTeamDto) {
    return this.teamsService.update(id, updateTeamDto);
  }

  @Patch(":id/players/:playerId/captain")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Set or unset a player as team captain" })
  @ApiBody({ type: SetCaptainDto })
  @ApiResponse({ status: 200, description: "Captain status updated successfully" })
  @AppErrorResponse(400, "Bad Request", "PATCH", "/api/teams/:id/players/:playerId/captain", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "PATCH", "/api/teams/:id/players/:playerId/captain", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PATCH", "/api/teams/:id/players/:playerId/captain", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "PATCH", "/api/teams/:id/players/:playerId/captain", "Player is not in this team")
  setCaptain(
    @Param("id") id: string,
    @Param("playerId") playerId: string,
    @Body() body: SetCaptainDto,
  ) {
    return this.teamsService.setCaptain(id, playerId, body.isCaptain);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Delete a team" })
  @ApiResponse({ status: 200, description: "Team deleted successfully" })
  @AppErrorResponse(401, "Unauthorized", "DELETE", "/api/teams/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "DELETE", "/api/teams/:id", "Requires ADMIN role")
  @AppErrorResponse(404, "Not Found", "DELETE", "/api/teams/:id", "Team not found")
  remove(@Param("id") id: string) {
    return this.teamsService.remove(id);
  }
}
