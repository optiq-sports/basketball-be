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
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchResponseDto } from './dto/match-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, MatchStatus } from '@prisma/client';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppErrorResponse } from '../common/decorators/api-errors.decorator';

@ApiTags('Matches')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: 'Create a new match' })
  @ApiBody({ type: CreateMatchDto })
  @ApiResponse({ status: 201, description: 'Match successfully created', type: MatchResponseDto })
  @AppErrorResponse(400, 'Bad Request', 'POST', '/api/matches', 'Invalid input data')
  @AppErrorResponse(401, 'Unauthorized', 'POST', '/api/matches', 'Invalid or missing access token')
  @AppErrorResponse(403, 'Forbidden', 'POST', '/api/matches', 'Requires ADMIN or STATISTICIAN role')
  @AppErrorResponse(404, 'Not Found', 'POST', '/api/matches', 'Tournament or Teams not found')
  create(@Body() createMatchDto: CreateMatchDto) {
    return this.matchesService.create(createMatchDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all matches' })
  @ApiQuery({ name: 'tournamentId', required: false, type: String, description: 'Filter by tournament ID' })
  @ApiQuery({ name: 'status', required: false, enum: MatchStatus, description: 'Filter by match status' })
  @ApiResponse({ status: 200, description: 'Returns a list of matches', type: [MatchResponseDto] })
  @AppErrorResponse(401, 'Unauthorized', 'GET', '/api/matches', 'Invalid or missing access token')
  findAll(
    @Query('tournamentId') tournamentId?: string,
    @Query('status') status?: MatchStatus,
  ) {
    return this.matchesService.findAll(tournamentId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific match by ID' })
  @ApiResponse({ status: 200, description: 'Returns the specific match', type: MatchResponseDto })
  @AppErrorResponse(401, 'Unauthorized', 'GET', '/api/matches/:id', 'Invalid or missing access token')
  @AppErrorResponse(404, 'Not Found', 'GET', '/api/matches/:id', 'Match not found')
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: 'Update a specific match' })
  @ApiBody({ type: UpdateMatchDto })
  @ApiResponse({ status: 200, description: 'Match successfully updated', type: MatchResponseDto })
  @AppErrorResponse(400, 'Bad Request', 'PATCH', '/api/matches/:id', 'Invalid input data')
  @AppErrorResponse(401, 'Unauthorized', 'PATCH', '/api/matches/:id', 'Invalid or missing access token')
  @AppErrorResponse(403, 'Forbidden', 'PATCH', '/api/matches/:id', 'Requires ADMIN or STATISTICIAN role')
  @AppErrorResponse(404, 'Not Found', 'PATCH', '/api/matches/:id', 'Match not found')
  update(@Param('id') id: string, @Body() updateMatchDto: UpdateMatchDto) {
    return this.matchesService.update(id, updateMatchDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a match' })
  @ApiResponse({ status: 200, description: 'Match successfully deleted' })
  @AppErrorResponse(401, 'Unauthorized', 'DELETE', '/api/matches/:id', 'Invalid or missing access token')
  @AppErrorResponse(403, 'Forbidden', 'DELETE', '/api/matches/:id', 'Requires ADMIN role')
  @AppErrorResponse(404, 'Not Found', 'DELETE', '/api/matches/:id', 'Match not found')
  remove(@Param('id') id: string) {
    return this.matchesService.remove(id);
  }
}

