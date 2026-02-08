import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team } from '@prisma/client';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    this.logger.log(`Creating team: ${createTeamDto.name} (${createTeamDto.code})`);

    // Check if team code already exists
    const existingTeam = await this.prisma.team.findUnique({
      where: { code: createTeamDto.code },
    });

    if (existingTeam) {
      throw new ConflictException(`Team with code ${createTeamDto.code} already exists`);
    }

    return this.prisma.team.create({
      data: createTeamDto,
    });
  }

  async findAll(): Promise<Team[]> {
    return this.prisma.team.findMany({
      include: {
        playerTeams: {
          where: { isActive: true },
          include: {
            player: true,
          },
          orderBy: { jerseyNumber: 'asc' },
        },
        _count: {
          select: {
            playerTeams: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        playerTeams: {
          where: { isActive: true },
          include: {
            player: true,
          },
          orderBy: { jerseyNumber: 'asc' },
        },
        tournamentTeams: {
          include: {
            tournament: true,
          },
        },
        homeMatches: {
          include: {
            awayTeam: true,
            tournament: true,
          },
        },
        awayMatches: {
          include: {
            homeTeam: true,
            tournament: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async update(id: string, updateTeamDto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);

    // If code is being updated, check for conflicts
    if (updateTeamDto.code && updateTeamDto.code !== team.code) {
      const existingTeam = await this.prisma.team.findUnique({
        where: { code: updateTeamDto.code },
      });

      if (existingTeam) {
        throw new ConflictException(`Team with code ${updateTeamDto.code} already exists`);
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: updateTeamDto,
      include: {
        playerTeams: {
          where: { isActive: true },
          include: {
            player: true,
          },
          orderBy: { jerseyNumber: 'asc' },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.prisma.team.delete({
      where: { id },
    });
    this.logger.log(`Deleted team: ${team.name} (${team.code})`);
  }
}
