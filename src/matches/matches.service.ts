import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";
import { MatchResponseDto } from "./dto/match-response.dto";
import { MatchStatus, Prisma } from "@prisma/client";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { getTenantFilter } from "../common/filters/tenant.filter";
import {
  PageMetaDto,
  PaginatedResponseDto,
} from "../common/dto/paginated-response.dto";
import { MatchFilterDto } from "./dto/match-filter.dto";
import { buildPrismaPagination } from "../common/utils/pagination.util";

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createMatchDto: CreateMatchDto,
    user: AuthenticatedUser,
  ): Promise<MatchResponseDto> {
    // Verify tournament exists and belongs to the user's tenants
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: createMatchDto.tournamentId, ...getTenantFilter(user) },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with ID ${createMatchDto.tournamentId} not found`,
      );
    }

    // Verify teams exist and are in the tournament
    const [homeTeam, awayTeam] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: createMatchDto.homeTeamId } }),
      this.prisma.team.findUnique({ where: { id: createMatchDto.awayTeamId } }),
    ]);

    if (!homeTeam) {
      throw new NotFoundException(
        `Home team with ID ${createMatchDto.homeTeamId} not found`,
      );
    }

    if (!awayTeam) {
      throw new NotFoundException(
        `Away team with ID ${createMatchDto.awayTeamId} not found`,
      );
    }

    // Check if teams are in the tournament
    const [homeTeamInTournament, awayTeamInTournament] = await Promise.all([
      this.prisma.tournamentTeam.findUnique({
        where: {
          tournamentId_teamId: {
            tournamentId: createMatchDto.tournamentId,
            teamId: createMatchDto.homeTeamId,
          },
        },
      }),
      this.prisma.tournamentTeam.findUnique({
        where: {
          tournamentId_teamId: {
            tournamentId: createMatchDto.tournamentId,
            teamId: createMatchDto.awayTeamId,
          },
        },
      }),
    ]);

    if (!homeTeamInTournament) {
      throw new BadRequestException("Home team is not part of this tournament");
    }

    if (!awayTeamInTournament) {
      throw new BadRequestException("Away team is not part of this tournament");
    }

    if (createMatchDto.homeTeamId === createMatchDto.awayTeamId) {
      throw new BadRequestException(
        "Home team and away team cannot be the same",
      );
    }

    return this.prisma.match.create({
      data: {
        tournamentId: createMatchDto.tournamentId,
        homeTeamId: createMatchDto.homeTeamId,
        awayTeamId: createMatchDto.awayTeamId,
        venue: createMatchDto.venue,
        statisticianId: createMatchDto.statisticianId,
        clientId: tournament.clientId,
        scheduledDate: new Date(
          createMatchDto.scheduledDate.endsWith("Z") ||
            createMatchDto.scheduledDate.includes("+") ||
            createMatchDto.scheduledDate.includes("-")
            ? createMatchDto.scheduledDate
            : `${createMatchDto.scheduledDate}Z`,
        ),
        status: createMatchDto.status || MatchStatus.SCHEDULED,
      },
      include: {
        tournament: true,
        homeTeam: true,
        awayTeam: true,
        statistician: true,
      },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filterDto: MatchFilterDto,
    statisticianId?: string,
  ): Promise<PaginatedResponseDto<MatchResponseDto>> {
    const {
      tournamentId,
      status,
      page = 1,
      limit = 10,
      sortBy,
      sortOrder,
      search,
      ...otherParams
    } = filterDto || {};

    const { skip, take, orderBy } = buildPrismaPagination(filterDto, {
      defaultOrderBy: { scheduledDate: "asc" },
    });

    const where: any = { tournament: getTenantFilter(user) };
    if (tournamentId) {
      where.tournamentId = tournamentId;
    }
    if (status) {
      where.status = status;
    }
    if (statisticianId) {
      where.statisticianId = statisticianId;
    }
    if (search) {
      where.OR = [
        { homeTeam: { name: { contains: search, mode: "insensitive" } } },
        { awayTeam: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, itemCount] = await Promise.all([
      this.prisma.match.findMany({
        where: {
          ...where,
          ...otherParams,
        },
        skip,
        take,
        include: {
          tournament: true,
          homeTeam: true,
          awayTeam: true,
          statistician: true,
          stats: {
            include: {
              player: {
                include: {
                  playerTeams: {
                    include: {
                      team: true,
                    },
                  },
                },
              },
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.match.count({
        where: {
          ...where,
          ...otherParams,
        },
      }),
    ]);

    return new PaginatedResponseDto(
      items,
      new PageMetaDto({ page, limit, itemCount }),
    );
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<MatchResponseDto> {
    const match = await this.prisma.match.findFirst({
      where: { id, tournament: getTenantFilter(user) },
      include: {
        tournament: true,
        statistician: true,
        gameSessions: {
          select: { id: true, status: true },
        },
        homeTeam: {
          include: {
            playerTeams: {
              where: { isActive: true },
              include: {
                player: true,
              },
              orderBy: { jerseyNumber: "asc" },
            },
          },
        },
        awayTeam: {
          include: {
            playerTeams: {
              where: { isActive: true },
              include: {
                player: true,
              },
              orderBy: { jerseyNumber: "asc" },
            },
          },
        },
        stats: {
          include: {
            player: {
              include: {
                playerTeams: {
                  include: { team: true },
                },
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return {
      ...match,
      gameSessions: match.gameSessions ? [match.gameSessions] : [],
    } as any;
  }

  async update(
    id: string,
    updateMatchDto: UpdateMatchDto,
    user: AuthenticatedUser,
  ): Promise<MatchResponseDto> {
    const match = await this.findOne(id, user);

    const updateData: any = { ...updateMatchDto };

    // Handle unassigning statistician if frontend passes an empty string
    if (updateData.statisticianId === "") {
      updateData.statisticianId = null;
    }

    if (updateMatchDto.scheduledDate) {
      updateData.scheduledDate = new Date(
        updateMatchDto.scheduledDate.endsWith("Z") ||
          updateMatchDto.scheduledDate.includes("+") ||
          updateMatchDto.scheduledDate.includes("-")
          ? updateMatchDto.scheduledDate
          : `${updateMatchDto.scheduledDate}Z`,
      );
    }

    // Calculate total score if quarter scores are provided
    if (
      updateMatchDto.quarter1Home !== undefined ||
      updateMatchDto.quarter2Home !== undefined ||
      updateMatchDto.quarter3Home !== undefined ||
      updateMatchDto.quarter4Home !== undefined ||
      updateMatchDto.overtimeHome !== undefined
    ) {
      const homeScore =
        (updateMatchDto.quarter1Home ?? match.quarter1Home ?? 0) +
        (updateMatchDto.quarter2Home ?? match.quarter2Home ?? 0) +
        (updateMatchDto.quarter3Home ?? match.quarter3Home ?? 0) +
        (updateMatchDto.quarter4Home ?? match.quarter4Home ?? 0) +
        (updateMatchDto.overtimeHome ?? match.overtimeHome ?? 0);
      updateData.homeScore = homeScore;
    }

    if (
      updateMatchDto.quarter1Away !== undefined ||
      updateMatchDto.quarter2Away !== undefined ||
      updateMatchDto.quarter3Away !== undefined ||
      updateMatchDto.quarter4Away !== undefined ||
      updateMatchDto.overtimeAway !== undefined
    ) {
      const awayScore =
        (updateMatchDto.quarter1Away ?? match.quarter1Away ?? 0) +
        (updateMatchDto.quarter2Away ?? match.quarter2Away ?? 0) +
        (updateMatchDto.quarter3Away ?? match.quarter3Away ?? 0) +
        (updateMatchDto.quarter4Away ?? match.quarter4Away ?? 0) +
        (updateMatchDto.overtimeAway ?? match.overtimeAway ?? 0);
      updateData.awayScore = awayScore;
    }

    return this.prisma.match.update({
      where: { id },
      data: updateData,
      include: {
        tournament: true,
        homeTeam: true,
        awayTeam: true,
        statistician: true,
        stats: {
          include: {
            player: true,
          },
        },
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const match = await this.findOne(id, user);
    await this.prisma.match.delete({
      where: { id },
    });
  }
}
