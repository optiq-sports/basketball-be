import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { AddTeamToTournamentDto } from './dto/add-team-to-tournament.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

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

  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.tournamentsService.findByCode(code);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  update(@Param('id') id: string, @Body() updateTournamentDto: UpdateTournamentDto) {
    return this.tournamentsService.update(id, updateTournamentDto);
  }

  @Post(':id/teams')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  addTeams(@Param('id') id: string, @Body() addTeamDto: AddTeamToTournamentDto) {
    return this.tournamentsService.addTeams(id, addTeamDto);
  }

  @Delete(':id/teams/:teamId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  removeTeam(@Param('id') id: string, @Param('teamId') teamId: string) {
    return this.tournamentsService.removeTeam(id, teamId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.tournamentsService.remove(id);
  }
}

