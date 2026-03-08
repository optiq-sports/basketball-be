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
import { FileInterceptor } from "@nestjs/platform-express";
import { TournamentsService } from "./tournaments.service";
import { CreateTournamentDto } from "./dto/create-tournament.dto";
import { UpdateTournamentDto } from "./dto/update-tournament.dto";
import { AddTeamToTournamentDto } from "./dto/add-team-to-tournament.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import { IUploadProvider } from "../upload/interfaces/upload-provider.interface";
import { UPLOAD_PROVIDER } from "../upload/upload.constants";

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
  create(@Body() createTournamentDto: CreateTournamentDto) {
    return this.tournamentsService.create(createTournamentDto);
  }

  @Get()
  findAll() {
    return this.tournamentsService.findAll();
  }

  @Get("code/:code")
  findByCode(@Param("code") code: string) {
    return this.tournamentsService.findByCode(code);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
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
  addTeams(
    @Param("id") id: string,
    @Body() addTeamDto: AddTeamToTournamentDto,
  ) {
    return this.tournamentsService.addTeams(id, addTeamDto);
  }

  @Delete(":id/teams/:teamId")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  removeTeam(@Param("id") id: string, @Param("teamId") teamId: string) {
    return this.tournamentsService.removeTeam(id, teamId);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.tournamentsService.remove(id);
  }
}
