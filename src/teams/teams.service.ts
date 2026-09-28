import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { Prisma, Team } from "@prisma/client";
import { PageMetaDto, PaginatedResponseDto } from "../common/dto/paginated-response.dto";
import { TeamFilterDto } from "./dto/team-filter.dto";
import { buildPrismaPagination } from "../common/utils/pagination.util";

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private prisma: PrismaService) { }

  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    this.logger.log(
      `Creating team: ${createTeamDto.name} (${createTeamDto.code})`,
    );

    // Check if team code already exists
    const existingTeam = await this.prisma.team.findUnique({
      where: { code: createTeamDto.code },
    });

    if (existingTeam) {
      throw new ConflictException(
        `Team with code ${createTeamDto.code} already exists`,
      );
    }

    return this.prisma.team.create({
      data: createTeamDto,
    });
  }

  async findAll(filterDto?: TeamFilterDto): Promise<PaginatedResponseDto<Team>> {
    const { tournamentId, page, limit, sortBy, sortOrder, search, ...otherParams } = filterDto || {};
    
    const { skip, take, orderBy, searchWhere } = buildPrismaPagination(filterDto, {
      defaultOrderBy: [{ name: 'asc' }],
      searchFields: ['name']
    });

    const [items, itemCount] = await Promise.all([
      this.prisma.team.findMany({
        where: {
          ...(tournamentId && { tournamentTeams: { some: { tournamentId } } }),
          ...searchWhere,
          ...otherParams
        },
        include: {
          playerTeams: {
            where: { isActive: true },
            include: {
              player: true,
            },
            orderBy: { jerseyNumber: "asc" },
          },
          _count: {
            select: {
              playerTeams: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.team.count({
        where: {
          ...(tournamentId && { tournamentTeams: { some: { tournamentId } } }),
          ...searchWhere,
          ...otherParams
        }
      }),
    ]);

    return new PaginatedResponseDto(items, new PageMetaDto({ page, limit, itemCount }));
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
          orderBy: { jerseyNumber: "asc" },
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
        throw new ConflictException(
          `Team with code ${updateTeamDto.code} already exists`,
        );
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
          orderBy: { jerseyNumber: "asc" },
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

  async setCaptain(teamId: string, playerId: string, isCaptain: boolean) {
    const playerTeam = await this.prisma.playerTeam.findFirst({
      where: {
        teamId,
        playerId,
        isActive: true,
      },
    });

    if (!playerTeam) {
      throw new NotFoundException(`Player not found in this team`);
    }

    // If setting as captain, first strip captain status from all other players in the team
    if (isCaptain) {
      await this.prisma.playerTeam.updateMany({
        where: { teamId, isActive: true },
        data: { isCaptain: false },
      });
    }

    // Set the target player's captain status
    await this.prisma.playerTeam.update({
      where: { id: playerTeam.id },
      data: { isCaptain },
    });

    // Return the full team with updated roster so caller can see all isCaptain flags
    return this.findOne(teamId);
  }
}
