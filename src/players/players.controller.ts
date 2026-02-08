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
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CreatePlayerForTeamDto } from './dto/create-player-for-team.dto';
import { BulkCreatePlayersForTeamDto } from './dto/bulk-create-players-for-team.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  /**
   * Create a standalone player (not assigned to any team)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  create(@Body() createPlayerDto: CreatePlayerDto) {
    return this.playersService.create(createPlayerDto);
  }

  /**
   * Create a player and assign to a team (with deduplication)
   */
  @Post('team')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  createForTeam(@Body() createPlayerDto: CreatePlayerForTeamDto) {
    return this.playersService.createForTeam(createPlayerDto);
  }

  /**
   * Bulk create players for a team (with deduplication)
   * This is the main endpoint for importing players
   */
  @Post('team/bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  bulkCreateForTeam(@Body() bulkDto: BulkCreatePlayersForTeamDto) {
    return this.playersService.bulkCreateForTeam(bulkDto);
  }

  /**
   * Get all players (optionally filtered by team)
   */
  @Get()
  findAll(@Query('teamId') teamId?: string) {
    return this.playersService.findAll(teamId);
  }

  /**
   * Get player by ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playersService.findOne(id);
  }

  /**
   * Update player
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  update(@Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
    return this.playersService.update(id, updatePlayerDto);
  }

  /**
   * Assign player to team
   */
  @Put(':id/teams/:teamId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  assignToTeam(
    @Param('id') playerId: string,
    @Param('teamId') teamId: string,
    @Body('jerseyNumber') jerseyNumber: number,
  ) {
    return this.playersService.assignToTeam(playerId, teamId, jerseyNumber);
  }

  /**
   * Remove player from team
   */
  @Delete(':id/teams/:teamId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  removeFromTeam(@Param('id') playerId: string, @Param('teamId') teamId: string) {
    return this.playersService.removeFromTeam(playerId, teamId);
  }

  /**
   * Remove player (deactivates all team associations)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.playersService.remove(id);
  }
}
