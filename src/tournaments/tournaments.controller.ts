import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiConsumes } from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import { TournamentsService } from "./tournaments.service";
import { CreateTournamentDto } from "./dto/create-tournament.dto";
import { UpdateTournamentDto } from "./dto/update-tournament.dto";
import { AddTeamToTournamentDto } from "./dto/add-team-to-tournament.dto";
import { TournamentResponseDto } from "./dto/tournament-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import { IUploadProvider } from "../upload/interfaces/upload-provider.interface";
import { UPLOAD_PROVIDER } from "../upload/upload.constants";

@ApiTags("Tournaments")
@ApiBearerAuth()
@Controller("tournaments")
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    @Inject(UPLOAD_PROVIDER) private readonly uploadProvider: IUploadProvider,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Create a new tournament" })
  @ApiBody({ type: CreateTournamentDto })
  @ApiResponse({ status: 201, description: "Tournament created successfully", type: TournamentResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/tournaments", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/tournaments", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/tournaments", "Requires ADMIN or STATISTICIAN role")
  create(@Body() createTournamentDto: CreateTournamentDto) {
    return this.tournamentsService.create(createTournamentDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all tournaments" })
  @ApiResponse({ status: 200, description: "Tournaments fetched successfully", type: [TournamentResponseDto] })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/tournaments", "Invalid or missing access token")
  findAll() {
    return this.tournamentsService.findAll();
  }

  @Get("code/:code")
  @ApiOperation({ summary: "Get tournament by unique code" })
  @ApiResponse({ status: 200, description: "Tournament fetched successfully", type: TournamentResponseDto })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/tournaments/code/:code", "Invalid or missing access token")
  @AppErrorResponse(404, "Not Found", "GET", "/api/tournaments/code/:code", "Tournament not found")
  findByCode(@Param("code") code: string) {
    return this.tournamentsService.findByCode(code);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get tournament by ID" })
  @ApiResponse({ status: 200, description: "Tournament fetched successfully", type: TournamentResponseDto })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/tournaments/:id", "Invalid or missing access token")
  @AppErrorResponse(404, "Not Found", "GET", "/api/tournaments/:id", "Tournament not found")
  findOne(@Param("id") id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Update tournament details" })
  @ApiBody({ type: UpdateTournamentDto })
  @ApiResponse({ status: 200, description: "Tournament updated successfully", type: TournamentResponseDto })
  @AppErrorResponse(400, "Bad Request", "PATCH", "/api/tournaments/:id", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "PATCH", "/api/tournaments/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PATCH", "/api/tournaments/:id", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "PATCH", "/api/tournaments/:id", "Tournament not found")
  update(
    @Param("id") id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(id, updateTournamentDto);
  }

  @Patch(":id/flyer")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @UseInterceptors(FileInterceptor("flyer"))
  @ApiOperation({ summary: "Upload a flyer for the tournament" })
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
  @ApiResponse({ status: 200, description: "Flyer uploaded successfully", type: TournamentResponseDto })
  @AppErrorResponse(400, "Bad Request", "PATCH", "/api/tournaments/:id/flyer", "Invalid file or no file uploaded")
  @AppErrorResponse(401, "Unauthorized", "PATCH", "/api/tournaments/:id/flyer", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PATCH", "/api/tournaments/:id/flyer", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "PATCH", "/api/tournaments/:id/flyer", "Tournament not found")
  @AppErrorResponse(500, "Internal Server Error", "PATCH", "/api/tournaments/:id/flyer", "Internal server error")
  async uploadFlyer(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        "No file uploaded. Use form-data key: flyer",
      );
    }
    const { url } = await this.uploadProvider.uploadFile(file);
    return this.tournamentsService.updateFlyer(id, url);
  }

  @Post(":id/teams")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Add teams to a tournament" })
  @ApiBody({ type: AddTeamToTournamentDto })
  @ApiResponse({ status: 200, description: "Teams added successfully", type: TournamentResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/tournaments/:id/teams", "Validation failed")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/tournaments/:id/teams", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/tournaments/:id/teams", "Requires ADMIN or STATISTICIAN role")
  @AppErrorResponse(404, "Not Found", "POST", "/api/tournaments/:id/teams", "Tournament or Teams not found")
  addTeams(
    @Param("id") id: string,
    @Body() addTeamDto: AddTeamToTournamentDto,
  ) {
    return this.tournamentsService.addTeams(id, addTeamDto);
  }

  @Delete(":id/teams/:teamId")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Remove a team from a tournament" })
  @ApiResponse({ status: 200, description: "Team removed successfully" })
  @AppErrorResponse(401, "Unauthorized", "DELETE", "/api/tournaments/:id/teams/:teamId", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "DELETE", "/api/tournaments/:id/teams/:teamId", "Requires ADMIN role")
  @AppErrorResponse(404, "Not Found", "DELETE", "/api/tournaments/:id/teams/:teamId", "Tournament or Team not found")
  removeTeam(@Param("id") id: string, @Param("teamId") teamId: string) {
    return this.tournamentsService.removeTeam(id, teamId);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Delete a tournament" })
  @ApiResponse({ status: 200, description: "Tournament deleted successfully" })
  @AppErrorResponse(401, "Unauthorized", "DELETE", "/api/tournaments/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "DELETE", "/api/tournaments/:id", "Requires ADMIN role")
  @AppErrorResponse(404, "Not Found", "DELETE", "/api/tournaments/:id", "Tournament not found")
  remove(@Param("id") id: string) {
    return this.tournamentsService.remove(id);
  }
  
}
