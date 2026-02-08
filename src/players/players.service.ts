import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PlayerDeduplicationService } from "../common/services/player-deduplication.service";
import { CreatePlayerDto } from "./dto/create-player.dto";
import { CreatePlayerForTeamDto } from "./dto/create-player-for-team.dto";
import { BulkCreatePlayersForTeamDto } from "./dto/bulk-create-players-for-team.dto";
import { UpdatePlayerDto } from "./dto/update-player.dto";
import { Player, PlayerTeam, PlayerPosition } from "@prisma/client";
import {
  BulkCreatePlayersResponseDto,
  PlayerResponseDto,
} from "./dto/player-response.dto";

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    private prisma: PrismaService,
    private deduplicationService: PlayerDeduplicationService,
  ) {}

  /**
   * Create a standalone player (not assigned to any team)
   */
  async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
    this.logger.log(
      `Creating player: ${createPlayerDto.firstName} ${createPlayerDto.lastName}`,
    );

    // Check for duplicate
    const duplicateCheck = await this.deduplicationService.findDuplicatePlayer({
      firstName: createPlayerDto.firstName,
      lastName: createPlayerDto.lastName,
      email: createPlayerDto.email,
      height: createPlayerDto.height,
      phone: createPlayerDto.phone,
      dateOfBirth: createPlayerDto.dateOfBirth
        ? new Date(createPlayerDto.dateOfBirth)
        : undefined,
    });

    if (duplicateCheck.isDuplicate) {
      this.logger.warn(
        `Duplicate player detected: ${duplicateCheck.similarityScore.toFixed(2)}% match with player ${duplicateCheck.existingPlayer.id}`,
      );
      throw new ConflictException(
        `Player already exists (${duplicateCheck.similarityScore.toFixed(2)}% similarity)`,
      );
    }

    // Check email uniqueness if provided
    if (createPlayerDto.email) {
      const existingEmail = await this.prisma.player.findUnique({
        where: { email: createPlayerDto.email },
      });
      if (existingEmail) {
        throw new ConflictException("Player with this email already exists");
      }
    }

    return this.prisma.player.create({
      data: {
        firstName: createPlayerDto.firstName,
        lastName: createPlayerDto.lastName,
        email: createPlayerDto.email,
        position: createPlayerDto.position,
        height: createPlayerDto.height,
        photo: createPlayerDto.photo,
        dateOfBirth: createPlayerDto.dateOfBirth
          ? new Date(createPlayerDto.dateOfBirth)
          : null,
        phone: createPlayerDto.phone,
      },
    });
  }

  /**
   * Create a player and assign to a team (with jersey number)
   * Uses deduplication - if player exists, assigns existing player to team
   */
  async createForTeam(
    createPlayerDto: CreatePlayerForTeamDto,
  ): Promise<PlayerResponseDto> {
    this.logger.log(
      `Creating player for team: ${createPlayerDto.firstName} ${createPlayerDto.lastName} (Team: ${createPlayerDto.teamId}, Jersey: ${createPlayerDto.jerseyNumber})`,
    );

    // Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: createPlayerDto.teamId },
    });

    if (!team) {
      throw new NotFoundException(
        `Team with ID ${createPlayerDto.teamId} not found`,
      );
    }

    // Check if jersey number is already taken in this team
    const existingJersey = await this.prisma.playerTeam.findFirst({
      where: {
        teamId: createPlayerDto.teamId,
        jerseyNumber: createPlayerDto.jerseyNumber,
        isActive: true,
      },
    });

    if (existingJersey) {
      throw new ConflictException(
        `Jersey number ${createPlayerDto.jerseyNumber} is already taken in this team`,
      );
    }

    // Use transaction for data integrity
    return this.prisma.$transaction(async (tx) => {
      // Check for duplicate player
      const duplicateCheck =
        await this.deduplicationService.findDuplicatePlayer({
          firstName: createPlayerDto.firstName,
          lastName: createPlayerDto.lastName,
          email: createPlayerDto.email,
          height: createPlayerDto.height,
          phone: createPlayerDto.phone,
          dateOfBirth: createPlayerDto.dateOfBirth
            ? new Date(createPlayerDto.dateOfBirth)
            : undefined,
        });

      let player: Player;

      if (duplicateCheck.isDuplicate && duplicateCheck.existingPlayer) {
        // Use existing player
        this.logger.log(
          `Using existing player ${duplicateCheck.existingPlayer.id} (${duplicateCheck.similarityScore.toFixed(2)}% match)`,
        );
        player = duplicateCheck.existingPlayer;
      } else {
        // Create new player
        if (createPlayerDto.email) {
          const existingEmail = await tx.player.findUnique({
            where: { email: createPlayerDto.email },
          });
          if (existingEmail) {
            throw new ConflictException(
              "Player with this email already exists",
            );
          }
        }

        player = await tx.player.create({
          data: {
            firstName: createPlayerDto.firstName,
            lastName: createPlayerDto.lastName,
            email: createPlayerDto.email,
            position: createPlayerDto.position,
            height: createPlayerDto.height,
            photo: createPlayerDto.photo,
            dateOfBirth: createPlayerDto.dateOfBirth
              ? new Date(createPlayerDto.dateOfBirth)
              : null,
            phone: createPlayerDto.phone,
          },
        });
      }

      // Assign player to team
      await tx.playerTeam.create({
        data: {
          playerId: player.id,
          teamId: createPlayerDto.teamId,
          jerseyNumber: createPlayerDto.jerseyNumber,
          isActive: true,
        },
      });

      // Return player with team info
      return this.formatPlayerResponse(player, createPlayerDto.teamId);
    });
  }

  /**
   * Bulk create players for a team with deduplication
   * This is the main method for importing players
   */
  async bulkCreateForTeam(
    bulkDto: BulkCreatePlayersForTeamDto,
  ): Promise<BulkCreatePlayersResponseDto> {
    this.logger.log(
      `Bulk creating ${bulkDto.players.length} players for team ${bulkDto.teamId}`,
    );

    // Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: bulkDto.teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${bulkDto.teamId} not found`);
    }

    // Check for duplicate jersey numbers
    const jerseyNumbers = bulkDto.players.map((p) => p.jerseyNumber);
    const duplicateJerseys = jerseyNumbers.filter(
      (num, index) => jerseyNumbers.indexOf(num) !== index,
    );
    if (duplicateJerseys.length > 0) {
      throw new BadRequestException(
        `Duplicate jersey numbers in request: ${duplicateJerseys.join(", ")}`,
      );
    }

    // Check existing active jerseys in team
    const existingJerseys = await this.prisma.playerTeam.findMany({
      where: {
        teamId: bulkDto.teamId,
        jerseyNumber: { in: jerseyNumbers },
        isActive: true,
      },
    });

    if (existingJerseys.length > 0) {
      throw new ConflictException(
        `Jersey numbers already taken: ${existingJerseys.map((ej) => ej.jerseyNumber).join(", ")}`,
      );
    }

    const result: BulkCreatePlayersResponseDto = {
      created: 0,
      duplicates: 0,
      players: [],
      duplicateMatches: [],
    };

    // Process in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const playerData of bulkDto.players) {
        // Check for duplicate
        const duplicateCheck =
          await this.deduplicationService.findDuplicatePlayer({
            firstName: playerData.firstName,
            lastName: playerData.lastName,
            email: playerData.email,
            height: playerData.height,
            phone: playerData.phone,
            dateOfBirth: playerData.dateOfBirth
              ? new Date(playerData.dateOfBirth)
              : undefined,
          });

        let player: Player;

        if (duplicateCheck.isDuplicate && duplicateCheck.existingPlayer) {
          // Use existing player
          result.duplicates++;
          result.duplicateMatches.push({
            candidate: {
              firstName: playerData.firstName,
              lastName: playerData.lastName,
            },
            existingPlayer: {
              id: duplicateCheck.existingPlayer.id,
              firstName: duplicateCheck.existingPlayer.firstName,
              lastName: duplicateCheck.existingPlayer.lastName,
            },
            similarityScore: duplicateCheck.similarityScore,
          });
          player = duplicateCheck.existingPlayer;
        } else {
          // Create new player
          if (playerData.email) {
            const existingEmail = await tx.player.findUnique({
              where: { email: playerData.email },
            });
            if (existingEmail) {
              // Email conflict - use existing
              player = existingEmail;
              result.duplicates++;
            } else {
              player = await tx.player.create({
                data: {
                  firstName: playerData.firstName,
                  lastName: playerData.lastName,
                  email: playerData.email,
                  position: playerData.position,
                  height: playerData.height,
                  photo: playerData.photo,
                  dateOfBirth: playerData.dateOfBirth
                    ? new Date(playerData.dateOfBirth)
                    : null,
                  phone: playerData.phone,
                },
              });
              result.created++;
            }
          } else {
            player = await tx.player.create({
              data: {
                firstName: playerData.firstName,
                lastName: playerData.lastName,
                email: playerData.email,
                position: playerData.position,
                height: playerData.height,
                photo: playerData.photo,
                dateOfBirth: playerData.dateOfBirth
                  ? new Date(playerData.dateOfBirth)
                  : null,
                phone: playerData.phone,
              },
            });
            result.created++;
          }
        }

        // Assign player to team
        await tx.playerTeam.create({
          data: {
            playerId: player.id,
            teamId: bulkDto.teamId,
            jerseyNumber: playerData.jerseyNumber,
            isActive: true,
          },
        });

        // Add to result
        result.players.push(
          await this.formatPlayerResponse(player, bulkDto.teamId),
        );
      }
    });

    this.logger.log(
      `Bulk create completed: ${result.created} new, ${result.duplicates} duplicates`,
    );

    return result;
  }

  /**
   * Get all players (optionally filtered by team)
   */
  async findAll(teamId?: string): Promise<PlayerResponseDto[]> {
    const where = teamId
      ? {
          playerTeams: {
            some: {
              teamId,
              isActive: true,
            },
          },
        }
      : {};

    const players = await this.prisma.player.findMany({
      where,
      include: {
        playerTeams: {
          where: teamId ? { teamId, isActive: true } : { isActive: true },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return Promise.all(players.map((p) => this.formatPlayerResponse(p)));
  }

  /**
   * Get player by ID
   */
  async findOne(id: string): Promise<PlayerResponseDto> {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        playerTeams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: { joinedAt: "desc" },
        },
        matchStats: {
          include: {
            match: {
              include: {
                homeTeam: { select: { id: true, name: true, code: true } },
                awayTeam: { select: { id: true, name: true, code: true } },
              },
            },
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    return this.formatPlayerResponse(player);
  }

  /**
   * Update player
   */
  async update(
    id: string,
    updatePlayerDto: UpdatePlayerDto,
  ): Promise<PlayerResponseDto> {
    const player = await this.prisma.player.findUnique({
      where: { id },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    // Check email uniqueness if being updated
    if (updatePlayerDto.email && updatePlayerDto.email !== player.email) {
      const existingEmail = await this.prisma.player.findUnique({
        where: { email: updatePlayerDto.email },
      });
      if (existingEmail) {
        throw new ConflictException("Player with this email already exists");
      }
    }

    const updatedPlayer = await this.prisma.player.update({
      where: { id },
      data: {
        ...updatePlayerDto,
        dateOfBirth: updatePlayerDto.dateOfBirth
          ? new Date(updatePlayerDto.dateOfBirth)
          : undefined,
      },
      include: {
        playerTeams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return this.formatPlayerResponse(updatedPlayer);
  }

  /**
   * Remove player (soft delete by deactivating all team associations)
   */
  async remove(id: string): Promise<void> {
    const player = await this.prisma.player.findUnique({
      where: { id },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    // Deactivate all team associations
    await this.prisma.playerTeam.updateMany({
      where: {
        playerId: id,
        isActive: true,
      },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    this.logger.log(`Deactivated all team associations for player ${id}`);
  }

  /**
   * Assign player to team
   */
  async assignToTeam(
    playerId: string,
    teamId: string,
    jerseyNumber: number,
  ): Promise<PlayerResponseDto> {
    // Verify player and team exist
    const [player, team] = await Promise.all([
      this.prisma.player.findUnique({ where: { id: playerId } }),
      this.prisma.team.findUnique({ where: { id: teamId } }),
    ]);

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Check jersey availability
    const existingJersey = await this.prisma.playerTeam.findFirst({
      where: {
        teamId,
        jerseyNumber,
        isActive: true,
      },
    });

    if (existingJersey) {
      throw new ConflictException(
        `Jersey number ${jerseyNumber} is already taken in this team`,
      );
    }

    // Check if association already exists
    const existing = await this.prisma.playerTeam.findFirst({
      where: {
        playerId,
        teamId,
        jerseyNumber,
      },
    });

    if (existing) {
      // Reactivate if inactive
      await this.prisma.playerTeam.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          leftAt: null,
        },
      });
    } else {
      // Create new association
      await this.prisma.playerTeam.create({
        data: {
          playerId,
          teamId,
          jerseyNumber,
          isActive: true,
        },
      });
    }

    return this.formatPlayerResponse(player, teamId);
  }

  /**
   * Remove player from team
   */
  async removeFromTeam(playerId: string, teamId: string): Promise<void> {
    await this.prisma.playerTeam.updateMany({
      where: {
        playerId,
        teamId,
        isActive: true,
      },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });
  }

  /**
   * Format player response with team information
   */
  private async formatPlayerResponse(
    player: Player & { playerTeams?: any[] },
    teamId?: string,
  ): Promise<PlayerResponseDto> {
    let playerTeams = player.playerTeams;

    if (!playerTeams && teamId) {
      playerTeams = await this.prisma.playerTeam.findMany({
        where: {
          playerId: player.id,
          ...(teamId ? { teamId } : {}),
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });
    }

    return {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email,
      position: player.position,
      height: player.height,
      photo: player.photo,
      dateOfBirth: player.dateOfBirth,
      phone: player.phone,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
      playerTeams: playerTeams?.map((pt) => ({
        id: pt.id,
        teamId: pt.teamId,
        jerseyNumber: pt.jerseyNumber,
        isActive: pt.isActive,
        joinedAt: pt.joinedAt,
        leftAt: pt.leftAt,
        team: pt.team,
      })),
    };
  }
}
