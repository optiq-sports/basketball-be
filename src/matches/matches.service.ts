import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { generateMatchKey } from "./utils/match-key.util";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";
import { MatchResponseDto } from "./dto/match-response.dto";
import { MatchStatus, Prisma, Role } from "@prisma/client";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { getTenantFilter } from "../common/filters/tenant.filter";
import {
  PageMetaDto,
  PaginatedResponseDto,
} from "../common/dto/paginated-response.dto";
import { MatchFilterDto } from "./dto/match-filter.dto";
import { buildPrismaPagination } from "../common/utils/pagination.util";

import { AuditLogsService } from "../audit-logs/audit-logs.service";

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

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

    let matchKey: string;
    if (createMatchDto.matchKey?.trim()) {
      const customKey = createMatchDto.matchKey.trim().toUpperCase();
      const existing = await this.prisma.match.findFirst({
        where: { matchKey: { equals: customKey, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `Match key "${customKey}" is already taken`,
        );
      }
      matchKey = customKey;
    } else {
      let candidate = generateMatchKey(8);
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await this.prisma.match.findFirst({
          where: { matchKey: candidate },
          select: { id: true },
        });
        if (!existing) break;
        candidate = generateMatchKey(8);
      }
      matchKey = candidate;
    }

    return this.prisma.match.create({
      data: {
        tournamentId: createMatchDto.tournamentId,
        homeTeamId: createMatchDto.homeTeamId,
        awayTeamId: createMatchDto.awayTeamId,
        venue: createMatchDto.venue,
        statisticianId: createMatchDto.statisticianId,
        clientId: tournament.clientId,
        matchKey,
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
        statistician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
      stage,
      page = 1,
      limit = 10,
      search,
    } = filterDto || {};

    const { skip, take, orderBy } = buildPrismaPagination(filterDto, {
      defaultOrderBy: { scheduledDate: "asc" },
    });

    let where: Prisma.MatchWhereInput;
    if (user.role === Role.SUPER_ADMIN) {
      where = {};
    } else if (user.role === Role.BROADCASTER) {
      where = {
        broadcasters: {
          some: {
            userId: user.id,
          },
        },
      };
    } else if (user.role === Role.STATISTICIAN) {
      const clientIds = user.clientIds || [];
      if (clientIds.length > 0) {
        where = {
          OR: [
            { statisticianId: user.id },
            {
              statisticianId: null,
              OR: [
                { clientId: { in: clientIds } },
                { tournament: { clientId: { in: clientIds } } },
              ],
            },
          ],
        };
      } else {
        where = {
          statisticianId: user.id,
        };
      }
    } else {
      const tenantFilter = getTenantFilter(user);
      where = {
        OR: [
          { clientId: { in: user.clientIds || [] } },
          { tournament: tenantFilter },
        ],
      };
    }
    if (tournamentId) {
      where.tournamentId = tournamentId;
    }
    if (status) {
      where.status = status;
    }
    if (stage) {
      where.stage = stage;
    }
    const andConditions: Prisma.MatchWhereInput[] = [];
    if (user.role !== Role.STATISTICIAN) {
      const targetStatId = statisticianId || filterDto?.statisticianId;
      if (targetStatId) {
        andConditions.push({
          OR: [{ statisticianId: targetStatId }, { statisticianId: null }],
        });
      }
    }
    if (search) {
      andConditions.push({
        OR: [
          { homeTeam: { name: { contains: search, mode: "insensitive" } } },
          { awayTeam: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [items, itemCount] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip,
        take,
        include: {
          tournament: true,
          homeTeam: true,
          awayTeam: true,
          statistician: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          broadcasters: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
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
          gameSessions: {
            select: {
              id: true,
              status: true,
              homeScore: true,
              awayScore: true,
              quarter: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.match.count({
        where,
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
    const normalizedId = id.trim();
    const idFilter: Prisma.MatchWhereInput = {
      OR: [
        { id: normalizedId },
        { matchKey: { equals: normalizedId, mode: "insensitive" } },
      ],
    };

    let where: Prisma.MatchWhereInput;
    if (user.role === Role.SUPER_ADMIN) {
      where = idFilter;
    } else if (user.role === Role.BROADCASTER) {
      where = {
        AND: [
          idFilter,
          {
            broadcasters: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      };
    } else if (user.role === Role.STATISTICIAN) {
      const clientIds = user.clientIds || [];
      where = {
        AND: [
          idFilter,
          {
            OR: [
              { statisticianId: user.id },
              {
                statisticianId: null,
                OR: [
                  ...(clientIds.length > 0
                    ? [
                        { clientId: { in: clientIds } },
                        { tournament: { clientId: { in: clientIds } } },
                      ]
                    : []),
                  { matchKey: { equals: normalizedId, mode: "insensitive" } },
                ],
              },
            ],
          },
        ],
      };
    } else {
      const tenantFilter = getTenantFilter(user);
      where = {
        AND: [
          idFilter,
          {
            OR: [
              { clientId: { in: user.clientIds || [] } },
              { tournament: tenantFilter },
            ],
          },
        ],
      };
    }

    const match = await this.prisma.match.findFirst({
      where,
      include: {
        tournament: true,
        statistician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        broadcasters: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        gameSessions: {
          select: {
            id: true,
            status: true,
            homeScore: true,
            awayScore: true,
            quarter: true,
          },
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
    } as unknown as MatchResponseDto;
  }

  async update(
    id: string,
    updateMatchDto: UpdateMatchDto,
    user: AuthenticatedUser,
  ): Promise<MatchResponseDto> {
    const match = await this.findOne(id, user);

    const updateData: Record<string, unknown> = { ...updateMatchDto };

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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.match.update({
        where: { id: match.id },
        data: updateData,
        include: {
          tournament: true,
          homeTeam: true,
          awayTeam: true,
          statistician: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          stats: {
            include: {
              player: true,
            },
          },
        },
      });

      if (
        updateData.homeScore !== undefined ||
        updateData.awayScore !== undefined ||
        updateData.status !== undefined
      ) {
        await this.auditLogsService.recordLog(tx, {
          actorUserId: user.id,
          actorRole: user.role,
          clientId:
            (match as unknown as { tournament?: { clientId?: string } })
              .tournament?.clientId ||
            user.clientIds?.[0] ||
            null,
          action: "UPDATE_RESULT",
          entityType: "match",
          entityId: id,
          before: {
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            status: match.status,
          },
          after: {
            homeScore: updated.homeScore,
            awayScore: updated.awayScore,
            status: updated.status,
          },
        });
      }

      return updated;
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const match = await this.findOne(id, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.match.delete({
        where: { id },
      });
      await this.auditLogsService.recordLog(tx, {
        actorUserId: user.id,
        actorRole: user.role,
        clientId:
          (match as unknown as { tournament?: { clientId?: string } })
            .tournament?.clientId ||
          user.clientIds?.[0] ||
          null,
        action: "DELETE",
        entityType: "match",
        entityId: id,
        before: match,
      });
    });
  }

  async assignBroadcasters(
    id: string,
    broadcasterIds: string[],
    user: AuthenticatedUser,
  ): Promise<MatchResponseDto> {
    const existingMatch = await this.prisma.match.findFirst({
      where: { id },
      include: { broadcasters: true },
    });
    if (!existingMatch) {
      throw new NotFoundException("Match not found");
    }

    if (
      user.role === Role.ADMIN &&
      user.clientIds &&
      !user.clientIds.includes(existingMatch.clientId)
    ) {
      throw new ForbiddenException(
        "You do not have permission to manage broadcasters for this match",
      );
    }

    if (broadcasterIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: broadcasterIds },
        },
        select: {
          id: true,
          role: true,
          clientUsers: {
            select: { clientId: true },
          },
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));
      const failures: string[] = [];

      for (const bId of broadcasterIds) {
        const u = userMap.get(bId);
        if (!u) {
          failures.push(`${bId} (not found)`);
        } else if (u.role !== Role.BROADCASTER) {
          failures.push(`${bId} (not a broadcaster)`);
        } else if (
          !u.clientUsers.some((cu) => cu.clientId === existingMatch.clientId)
        ) {
          failures.push(`${bId} (other client)`);
        }
      }

      if (failures.length > 0) {
        throw new BadRequestException(
          `One or more broadcaster IDs are invalid: ${failures.join(", ")}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.matchBroadcaster.deleteMany({
        where: { matchId: id },
      });

      if (broadcasterIds.length > 0) {
        await tx.matchBroadcaster.createMany({
          data: broadcasterIds.map((userId) => ({
            matchId: id,
            userId,
            assignedByUserId: user.id,
          })),
        });
      }

      await this.auditLogsService.recordLog(tx, {
        actorUserId: user.id,
        actorRole: user.role,
        action: "UPDATE",
        entityType: "match_broadcasters",
        entityId: id,
        before: { broadcasters: existingMatch.broadcasters },
        after: { broadcasterIds },
      });
    });

    return this.findOne(id, user);
  }
}
