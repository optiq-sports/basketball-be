import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";
import { Match, MatchStatus } from "@prisma/client";

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  async create(createMatchDto: CreateMatchDto): Promise<Match> {
    // Verify tournament exists
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: createMatchDto.tournamentId },
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
        ...createMatchDto,
        scheduledDate: new Date(createMatchDto.scheduledDate),
        status: createMatchDto.status || MatchStatus.SCHEDULED,
      },
      include: {
        tournament: true,
        homeTeam: true,
        awayTeam: true,
      },
    });
  }

  async findAll(tournamentId?: string, status?: MatchStatus): Promise<Match[]> {
    const where: any = {};
    if (tournamentId) {
      where.tournamentId = tournamentId;
    }
    if (status) {
      where.status = status;
    }

    return this.prisma.match.findMany({
      where,
      include: {
        tournament: true,
        homeTeam: true,
        awayTeam: true,
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
      },
      orderBy: { scheduledDate: "asc" },
    });
  }

  async findOne(id: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        tournament: true,
        homeTeam: {
          include: {
            playerTeams: {
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

    return match;
  }

  async update(id: string, updateMatchDto: UpdateMatchDto): Promise<Match> {
    const match = await this.findOne(id);

    const updateData: any = { ...updateMatchDto };
    if (updateMatchDto.scheduledDate) {
      updateData.scheduledDate = new Date(updateMatchDto.scheduledDate);
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
        stats: {
          include: {
            player: true,
          },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    const match = await this.findOne(id);
    await this.prisma.match.delete({
      where: { id },
    });
  }
}
