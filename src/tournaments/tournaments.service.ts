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
import { Tournament } from "@prisma/client";
import * as crypto from "crypto";

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  private generateTournamentCode(): string {
    return crypto.randomBytes(6).toString("hex").toUpperCase();
  }

  async create(createTournamentDto: CreateTournamentDto): Promise<Tournament> {
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
        startDate: new Date(createTournamentDto.startDate),
        endDate: createTournamentDto.endDate
          ? new Date(createTournamentDto.endDate)
          : null,
        numberOfQuarters: createTournamentDto.numberOfQuarters || 4,
      },
    });
  }

  async findAll(): Promise<Tournament[]> {
    return this.prisma.tournament.findMany({
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
        _count: {
          select: {
            teams: true,
            matches: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    });
  }

  async findOne(id: string): Promise<Tournament> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
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

  async findByCode(code: string): Promise<Tournament> {
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
  ): Promise<Tournament> {
    await this.findOne(id);

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
  ): Promise<Tournament> {
    const tournament = await this.findOne(id);

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
          update: {},
          create: {
            tournamentId: id,
            teamId,
          },
        }),
      ),
    );

    return this.findOne(id);
  }

  async removeTeam(id: string, teamId: string): Promise<void> {
    const tournament = await this.findOne(id);

    await this.prisma.tournamentTeam.delete({
      where: {
        tournamentId_teamId: {
          tournamentId: id,
          teamId,
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    const tournament = await this.findOne(id);
    await this.prisma.tournament.delete({
      where: { id },
    });
  }
}
