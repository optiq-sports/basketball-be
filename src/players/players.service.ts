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
import * as xlsx from "xlsx";

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
      nationality: createPlayerDto.nationality,
    });

    if (duplicateCheck.matchType === "EXACT_MATCH") {
      this.logger.warn(
        `Exact match duplicate found: ${duplicateCheck.existingPlayer.id}`,
      );
      throw new ConflictException(
        `Player already exists exactly (ID: ${duplicateCheck.existingPlayer.id})`,
      );
    }

    if (duplicateCheck.matchType === "POTENTIAL_DUPLICATE") {
      if (createPlayerDto.confirmDuplicate) {
        this.logger.log(`Confirmed creation of potential duplicate player`);
      } else {
        this.logger.warn(
          `Potential duplicate detected: ${duplicateCheck.similarityScore.toFixed(2)}% match`,
        );
        throw new ConflictException({
          message: `Potential duplicate found (${duplicateCheck.similarityScore.toFixed(2)}% similarity). Verify and confirm to proceed.`,
          duplicatePlayer: duplicateCheck.existingPlayer,
          similarityScore: duplicateCheck.similarityScore,
          matchedFields: duplicateCheck.matchedFields,
          requiresConfirmation: true,
        });
      }
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
        nationality: createPlayerDto.nationality,
      } as any,
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
    return this.prisma.$transaction(
      async (tx) => {
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
            nationality: createPlayerDto.nationality,
          });

        let player: Player;

        if (
          duplicateCheck.matchType === "EXACT_MATCH" &&
          duplicateCheck.existingPlayer
        ) {
          // EXACT MATCH -> Always use existing player (auto-link)
          // Or should we error? Requirement says "Use Existing Player", so auto-link is safer for creating *for team* workflow
          // But for consistency let's log it.
          this.logger.log(
            `Using existing player (Exact Match) ${duplicateCheck.existingPlayer.id}`,
          );
          player = duplicateCheck.existingPlayer;
        } else if (
          duplicateCheck.matchType === "POTENTIAL_DUPLICATE" &&
          duplicateCheck.existingPlayer
        ) {
          if (createPlayerDto.confirmDuplicate) {
            // Create NEW player despite duplicate
            this.logger.log(
              `Confirmed creation of potential duplicate player in team assignment`,
            );
            // Fallthrough to create new
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
                nationality: createPlayerDto.nationality,
              },
            });
          } else {
            // Default behavior: Use Existing (Link UUID) OR Error?
            // Requirement: "Admin must choose... Use Existing Player ... Create New Player"
            // Since this is an API, we should probably ERROR and ask for decision,
            // UNLESS we want to default to "Use Existing" for convenience?
            // "If similarity score > threshold ... System flags ... Admin must choose"
            // So we must error.
            throw new ConflictException({
              message: `Potential duplicate found (${duplicateCheck.similarityScore.toFixed(2)}% similarity). Verify and confirm to proceed or use existing ID.`,
              duplicatePlayer: duplicateCheck.existingPlayer,
              similarityScore: duplicateCheck.similarityScore,
              matchedFields: duplicateCheck.matchedFields,
              requiresConfirmation: true,
            });
          }
        } else {
          // NO MATCH -> Create new player
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
              nationality: createPlayerDto.nationality,
            } as any,
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
      },
      { timeout: 30000 },
    );
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
            nationality: playerData.nationality,
          });

        let player: Player;

        if (
          duplicateCheck.matchType === "EXACT_MATCH" &&
          duplicateCheck.existingPlayer
        ) {
          // EXACT MATCH -> Use existing
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
            similarityScore: 100,
          });
          player = duplicateCheck.existingPlayer;
        } else if (
          duplicateCheck.matchType === "POTENTIAL_DUPLICATE" &&
          duplicateCheck.existingPlayer
        ) {
          // POTENTIAL DUPLICATE in BULK upload
          // We can't ask for confirmation mid-stream easily.
          // Policy: Log as duplicate reference, but DO NOT CREATE NEW.
          // Or should we create new?
          // "Admin uploads... System runs checks... Flags potential duplicate"
          // For Bulk, usually we want to accept exacts, and maybe REJECT potentials for manual review?
          // Let's implement: Use Existing if Exact, otherwise Create New but flag? NO that creates duplicates.
          // Safer: Treat Potentials as Duplicates to be manual resolved.
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
          player = duplicateCheck.existingPlayer; // Link to the potential match? Risk of wrong link.
          // Correct approach for bulk: If uncertain, DO NOT LINK, DO NOT CREATE? Or Create and Flag?
          // "If similarity score > threshold... Admin must choose"
          // Since we can't choose, let's LINK to the best match but log it.
          // OR we can create a new player and user moves to merge later.
          // Let's stick to: Link to best match for now to avoid blocking, but maybe we should rely on Exact only?
          // Let's use the EXISTING logic which was "Use Existing".
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
                  nationality: playerData.nationality,
                } as any,
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
                nationality: playerData.nationality,
              } as any,
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
      nationality: player.nationality, // Add nationality to response
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

  /**
   * Process Bulk Upload from Excel
   */
  async processBulkUpload(teamId: string, file: any) {
    this.logger.log(`Processing bulk upload for team ${teamId}`);

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Read raw data
    const rawData = xlsx.utils.sheet_to_json(worksheet);

    const result = {
      totalProcessed: rawData.length,
      created: 0,
      duplicatesFound: 0,
      errors: [] as any[],
      details: [] as any[],
    };

    if (rawData.length === 0) {
      return result;
    }

    // Process each row
    // Use transaction? Maybe per-row is safer for partial success, or all-or-nothing?
    // Requirement implies "Admin uploads -> System runs checks".
    // If we have duplicates, we might want to just REPORT them and not block the rest,
    // OR create the valid ones and report duplicates.
    // Let's create valid ones and report duplicates/potential duplicates.

    for (const [index, row] of (rawData as any[]).entries()) {
      const rowNumber = index + 2; // Excel row number (1-header, 0-indexed)
      try {
        // Basic Mapping & Validation
        const firstName =
          row["First Name"] || row["firstname"] || row["FirstName"];
        const lastName = row["Last Name"] || row["lastname"] || row["LastName"];
        if (!firstName || !lastName) {
          result.errors.push({
            row: rowNumber,
            error: "Missing First or Last Name",
          });
          continue;
        }

        const candidate = {
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: row["Email"] ? String(row["Email"]).trim() : undefined,
          height: row["Height"] ? String(row["Height"]) : undefined,
          phone: row["Phone"] ? String(row["Phone"]) : undefined,
          dateOfBirth:
            row["Date of Birth"] || row["DOB"]
              ? new Date(row["Date of Birth"] || row["DOB"])
              : undefined,
          nationality:
            row["Nationality"] || row["Country"]
              ? String(row["Nationality"] || row["Country"]).trim()
              : undefined,
          jerseyNumber:
            row["Jersey Number"] || row["Jersey"]
              ? parseInt(row["Jersey Number"] || row["Jersey"])
              : undefined,
          position: row["Position"]
            ? (row["Position"] as PlayerPosition)
            : undefined,
        };

        // 1. Deduplication Check
        const duplicateCheck =
          await this.deduplicationService.findDuplicatePlayer(candidate);

        if (
          duplicateCheck.matchType !== "NO_MATCH" &&
          duplicateCheck.existingPlayer
        ) {
          result.duplicatesFound++;
          result.details.push({
            row: rowNumber,
            status: duplicateCheck.matchType,
            player: `${candidate.firstName} ${candidate.lastName}`,
            matchScore: duplicateCheck.similarityScore.toFixed(2),
            existingPlayerId: duplicateCheck.existingPlayer.id,
            action: "SKIPPED", // We skip duplicates in bulk upload to avoid mess
          });

          // If EXACT match, we COULD link to team?
          // "Step 1 - Exact Match Found -> Use existing UUID"
          // Let's Link it!
          if (teamId && candidate.jerseyNumber) {
            // Check jersey availability
            const existingJersey = await this.prisma.playerTeam.findFirst({
              where: {
                teamId,
                jerseyNumber: candidate.jerseyNumber,
                isActive: true,
              },
            });

            if (!existingJersey) {
              // Check if already in team
              const alreadyInTeam = await this.prisma.playerTeam.findFirst({
                where: {
                  teamId,
                  playerId: duplicateCheck.existingPlayer.id,
                  isActive: true,
                },
              });

              if (!alreadyInTeam) {
                await this.prisma.playerTeam.create({
                  data: {
                    playerId: duplicateCheck.existingPlayer.id,
                    teamId,
                    jerseyNumber: candidate.jerseyNumber,
                    isActive: true,
                  },
                });
                result.details[result.details.length - 1].action = "LINKED";
              } else {
                result.details[result.details.length - 1].action =
                  "ALREADY_IN_TEAM";
              }
            } else {
              result.errors.push({
                row: rowNumber,
                error: `Jersey ${candidate.jerseyNumber} taken`,
              });
            }
          }
        } else {
          // Create New
          // Check jersey if needed
          if (candidate.jerseyNumber) {
            const existingJersey = await this.prisma.playerTeam.findFirst({
              where: {
                teamId,
                jerseyNumber: candidate.jerseyNumber,
                isActive: true,
              },
            });
            if (existingJersey) {
              result.errors.push({
                row: rowNumber,
                error: `Jersey ${candidate.jerseyNumber} taken`,
              });
              continue;
            }
          }

          const newPlayer = await this.prisma.player.create({
            data: {
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              email: candidate.email, // Unique constraint key!
              height: candidate.height,
              phone: candidate.phone,
              dateOfBirth: candidate.dateOfBirth,
              nationality: candidate.nationality,
              position: candidate.position,
            } as any,
          });

          if (teamId && candidate.jerseyNumber) {
            await this.prisma.playerTeam.create({
              data: {
                playerId: newPlayer.id,
                teamId,
                jerseyNumber: candidate.jerseyNumber,
                isActive: true,
              },
            });
          }
          result.created++;
        }
      } catch (error: any) {
        result.errors.push({ row: rowNumber, error: error.message });
      }
    }

    return result;
  }

  /**
   * Merge two player profiles
   * Moves all team associations and match stats from duplicate to target
   * Then deactivates/deletes the duplicate
   */
  async mergePlayers(duplicatePlayerId: string, targetPlayerId: string) {
    if (duplicatePlayerId === targetPlayerId) {
      throw new BadRequestException("Cannot merge player with themselves");
    }

    const [duplicate, target] = await Promise.all([
      this.prisma.player.findUnique({ where: { id: duplicatePlayerId } }),
      this.prisma.player.findUnique({ where: { id: targetPlayerId } }),
    ]);

    if (!duplicate)
      throw new NotFoundException(
        `Duplicate player ${duplicatePlayerId} not found`,
      );
    if (!target)
      throw new NotFoundException(`Target player ${targetPlayerId} not found`);

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Move active team associations
        const duplicateTeams = await tx.playerTeam.findMany({
          where: { playerId: duplicatePlayerId, isActive: true },
        });

        for (const teamAssoc of duplicateTeams) {
          // Check if target is already in this team
          const targetInTeam = await tx.playerTeam.findFirst({
            where: {
              playerId: targetPlayerId,
              teamId: teamAssoc.teamId,
              isActive: true,
            },
          });

          if (!targetInTeam) {
            // Move association
            await tx.playerTeam.update({
              where: { id: teamAssoc.id },
              data: { playerId: targetPlayerId },
            });
          } else {
            // Deactivate duplicate's association since target is already there
            await tx.playerTeam.update({
              where: { id: teamAssoc.id },
              data: { isActive: false, leftAt: new Date() },
            });
          }
        }

        // 2. Move Match Stats
        await tx.matchStat.updateMany({
          where: { playerId: duplicatePlayerId },
          data: { playerId: targetPlayerId },
        });

        // 3. Move Match Player records (rosters)
        // This is tricky because unique constraints might exist on (matchId, playerId)
        // simplest approach: try update, if fail (conflict), delete duplicate's record
        const duplicateMatchPlayers = await tx.matchPlayer.findMany({
          where: { playerId: duplicatePlayerId },
        });

        for (const mp of duplicateMatchPlayers) {
          const targetInMatch = await tx.matchPlayer.findFirst({
            where: { matchId: mp.matchId, playerId: targetPlayerId },
          });

          if (!targetInMatch) {
            await tx.matchPlayer.update({
              where: { id: mp.id },
              data: { playerId: targetPlayerId },
            });
          } else {
            // Target already in match, delete duplicate entry
            await tx.matchPlayer.delete({ where: { id: mp.id } });
          }
        }

        // 4. Delete (or Deactivate) Duplicate Player
        // Since we moved everything, we can delete? Or keep as inactive?
        // Soft delete is safer if we add an 'isActive' or 'status' field to Player.
        // But Player doesn't have status field yet.
        // Let's DELETE for now as per "Delete duplicate profile" in requirements.
        // First, delete inactive team associations too or move them?
        // Delete duplicate's remaining (inactive) team associations
        await tx.playerTeam.deleteMany({
          where: { playerId: duplicatePlayerId },
        });

        // Now delete player
        await tx.player.delete({ where: { id: duplicatePlayerId } });

        this.logger.log(
          `Merged player ${duplicatePlayerId} into ${targetPlayerId}`,
        );
        return this.formatPlayerResponse(target);
      },
      { timeout: 30000 },
    );
  }
}
