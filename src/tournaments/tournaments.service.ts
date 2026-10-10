import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTournamentDto } from "./dto/create-tournament.dto";
import { UpdateTournamentDto } from "./dto/update-tournament.dto";
import { AddTeamToTournamentDto } from "./dto/add-team-to-tournament.dto";
import { Prisma, Tournament } from "@prisma/client";
import * as crypto from "crypto";
import { TournamentResponseDto } from "./dto/tournament-response.dto";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import {
  PageMetaDto,
  PaginatedResponseDto,
} from "../common/dto/paginated-response.dto";
import { getTenantFilter } from "../common/filters/tenant.filter";
import { buildPrismaPagination } from "../common/utils/pagination.util";

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  private generateTournamentCode(): string {
    return crypto.randomBytes(6).toString("hex").toUpperCase();
  }

  async create(
    createTournamentDto: CreateTournamentDto,
    user: AuthenticatedUser,
  ): Promise<TournamentResponseDto> {
    const clientIdToUse = createTournamentDto.clientId || user.clientIds?.[0];

    if (!clientIdToUse) {
      throw new BadRequestException(
        "A valid clientId must be provided to create a tournament",
      );
    }

    if (user.role !== "SUPER_ADMIN") {
      if (!user.clientIds?.includes(clientIdToUse)) {
        throw new BadRequestException(
          `You are not authorized to create a tournament for client ${clientIdToUse}`,
        );
      }
    } else {
      // Verify the client exists since Super Admins bypass the token-based clientIds check
      const clientExists = await this.prisma.client.findUnique({
        where: { id: clientIdToUse },
        select: { id: true },
      });
      if (!clientExists) {
        throw new BadRequestException(
          `The provided client ID "${clientIdToUse}" does not exist.`,
        );
      }
    }
    // Check for idempotency: Prevent duplicates with same name and division
    const duplicate = await this.prisma.tournament.findFirst({
      where: {
        name: createTournamentDto.name,
        division: createTournamentDto.division,
        clientId: clientIdToUse,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        `A tournament with the name "${createTournamentDto.name}" and division "${createTournamentDto.division}" already exists.`,
      );
    }

    // Generate unique tournament code
    let code: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      code = this.generateTournamentCode();
      const existing = await this.prisma.tournament.findUnique({
        where: { code },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new ConflictException("Failed to generate unique tournament code");
    }

    return this.prisma.tournament.create({
      data: {
        ...createTournamentDto,
        code,
        clientId: clientIdToUse,
        startDate: new Date(createTournamentDto.startDate),
        endDate: createTournamentDto.endDate
          ? new Date(createTournamentDto.endDate)
          : null,
        numberOfQuarters: createTournamentDto.numberOfQuarters || 4,
      },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    paginationDto?: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<TournamentResponseDto>> {
    const { page, limit, sortBy, sortOrder, search, ...otherParams } =
      paginationDto || {};
    const { skip, take, orderBy, searchWhere } = buildPrismaPagination(
      paginationDto,
      {
        defaultOrderBy: { createdAt: "desc" },
        searchFields: ["name"],
      },
    );
    const [data, itemCount] = await Promise.all([
      this.prisma.tournament.findMany({
        where: {
          ...getTenantFilter(user),
          ...searchWhere,
          ...otherParams,
        },
        include: {
          teams: {
            include: {
              team: true,
            },
          },
          matches: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          _count: {
            select: {
              teams: true,
              matches: true,
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.tournament.count({
        where: {
          ...getTenantFilter(user),
          ...searchWhere,
          ...otherParams,
        },
      }),
    ]);

    return new PaginatedResponseDto(
      data,
      new PageMetaDto({ page, limit, itemCount }),
    );
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id, ...getTenantFilter(user) },
      include: {
        teams: {
          include: {
            team: {
              include: {
                playerTeams: {
                  include: {
                    player: true,
                  },
                  orderBy: { jerseyNumber: "asc" },
                },
              },
            },
          },
        },
        matches: {
          include: {
            homeTeam: true,
            awayTeam: true,
            stats: {
              include: {
                player: true,
              },
            },
          },
          orderBy: { scheduledDate: "asc" },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${id} not found`);
    }

    return tournament;
  }

  async findByCode(code: string): Promise<TournamentResponseDto> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { code },
      include: {
        teams: {
          include: {
            team: {
              include: {
                playerTeams: {
                  include: {
                    player: true,
                  },
                  orderBy: { jerseyNumber: "asc" },
                },
              },
            },
          },
        },
        matches: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
          orderBy: { scheduledDate: "asc" },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with code ${code} not found`);
    }

    return tournament;
  }

  async update(
    id: string,
    updateTournamentDto: UpdateTournamentDto,
    user: AuthenticatedUser,
  ): Promise<TournamentResponseDto> {
    await this.findOne(id, user);

    const updateData: any = { ...updateTournamentDto };
    if (updateTournamentDto.startDate) {
      updateData.startDate = new Date(updateTournamentDto.startDate);
    }
    if (updateTournamentDto.endDate !== undefined) {
      updateData.endDate = updateTournamentDto.endDate
        ? new Date(updateTournamentDto.endDate)
        : null;
    }

    return this.prisma.tournament.update({
      where: { id },
      data: updateData,
      include: {
        teams: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async addTeams(
    id: string,
    addTeamDto: AddTeamToTournamentDto,
    user: AuthenticatedUser,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.findOne(id, user);

    // Verify all teams exist
    const teams = await this.prisma.team.findMany({
      where: {
        id: {
          in: addTeamDto.teamIds,
        },
      },
    });

    if (teams.length !== addTeamDto.teamIds.length) {
      throw new NotFoundException("One or more teams not found");
    }

    // Add teams to tournament (skip if already exists)
    await Promise.all(
      addTeamDto.teamIds.map((teamId) =>
        this.prisma.tournamentTeam.upsert({
          where: {
            tournamentId_teamId: {
              tournamentId: id,
              teamId,
            },
          },
          update: {
            group: addTeamDto.group,
          },
          create: {
            tournamentId: id,
            teamId,
            group: addTeamDto.group,
          },
        }),
      ),
    );

    return this.findOne(id, user);
  }

  async removeTeam(
    id: string,
    teamId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const tournament = await this.findOne(id, user);

    await this.prisma.tournamentTeam.delete({
      where: {
        tournamentId_teamId: {
          tournamentId: id,
          teamId,
        },
      },
    });
  }

  async updateFlyer(
    id: string,
    flyerUrl: string,
    user: AuthenticatedUser,
  ): Promise<TournamentResponseDto> {
    await this.findOne(id, user);
    return this.prisma.tournament.update({
      where: { id },
      data: { flyer: flyerUrl },
      include: {
        teams: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    await this.prisma.tournament.delete({
      where: { id },
    });
  }
}
