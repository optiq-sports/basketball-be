import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StringSimilarity } from '../utils/string-similarity.util';
import { Player, PlayerPosition } from '@prisma/client';

export interface PlayerMatchCandidate {
  player: Player;
  similarityScore: number;
  matchedFields: string[];
}

export interface PlayerDeduplicationResult {
  existingPlayer: Player | null;
  similarityScore: number;
  isDuplicate: boolean;
  matchedFields: string[];
}

@Injectable()
export class PlayerDeduplicationService {
  private readonly logger = new Logger(PlayerDeduplicationService.name);
  private readonly SIMILARITY_THRESHOLD = 98.0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find potential duplicate players based on multiple criteria
   * Returns the best match if similarity >= 98%
   */
  async findDuplicatePlayer(
    candidate: {
      firstName: string;
      lastName: string;
      email?: string;
      height?: string;
      phone?: string;
      dateOfBirth?: Date;
    },
  ): Promise<PlayerDeduplicationResult> {
    const normalizedFirstName = StringSimilarity.normalize(candidate.firstName);
    const normalizedLastName = StringSimilarity.normalize(candidate.lastName);

    // Get all players for comparison
    const allPlayers = await this.prisma.player.findMany({
      include: {
        playerTeams: {
          include: {
            team: true,
          },
        },
      },
    });

    let bestMatch: PlayerMatchCandidate | null = null;

    for (const player of allPlayers) {
      const similarity = this.calculatePlayerSimilarity(candidate, player);

      if (similarity.score >= this.SIMILARITY_THRESHOLD) {
        if (!bestMatch || similarity.score > bestMatch.similarityScore) {
          bestMatch = {
            player,
            similarityScore: similarity.score,
            matchedFields: similarity.matchedFields,
          };
        }
      }
    }

    if (bestMatch) {
      this.logger.log(
        `Found duplicate player: ${bestMatch.player.id} (${bestMatch.similarityScore.toFixed(2)}% match)`,
      );
      return {
        existingPlayer: bestMatch.player,
        similarityScore: bestMatch.similarityScore,
        isDuplicate: true,
        matchedFields: bestMatch.matchedFields,
      };
    }

    return {
      existingPlayer: null,
      similarityScore: 0,
      isDuplicate: false,
      matchedFields: [],
    };
  }

  /**
   * Calculate comprehensive similarity score between candidate and existing player
   */
  private calculatePlayerSimilarity(
    candidate: {
      firstName: string;
      lastName: string;
      email?: string;
      height?: string;
      phone?: string;
      dateOfBirth?: Date;
    },
    existingPlayer: Player,
  ): { score: number; matchedFields: string[] } {
    const weights = {
      firstName: 25,
      lastName: 25,
      email: 30,
      height: 10,
      phone: 5,
      dateOfBirth: 5,
    };

    let totalScore = 0;
    let totalWeight = 0;
    const matchedFields: string[] = [];

    // First name comparison
    const firstNameScore = StringSimilarity.compare(
      candidate.firstName,
      existingPlayer.firstName,
    );
    totalScore += firstNameScore * weights.firstName;
    totalWeight += weights.firstName;
    if (firstNameScore >= 90) matchedFields.push('firstName');

    // Last name comparison
    const lastNameScore = StringSimilarity.compare(
      candidate.lastName,
      existingPlayer.lastName,
    );
    totalScore += lastNameScore * weights.lastName;
    totalWeight += weights.lastName;
    if (lastNameScore >= 90) matchedFields.push('lastName');

    // Email comparison (exact match gets 100%, similar gets partial)
    if (candidate.email && existingPlayer.email) {
      const email1 = candidate.email.toLowerCase().trim();
      const email2 = existingPlayer.email.toLowerCase().trim();
      const emailScore = email1 === email2 ? 100 : StringSimilarity.compare(email1, email2);
      totalScore += emailScore * weights.email;
      totalWeight += weights.email;
      if (emailScore >= 90) matchedFields.push('email');
    } else if (!candidate.email && !existingPlayer.email) {
      // Both missing - don't penalize
      totalWeight += weights.email;
    }

    // Height comparison
    if (candidate.height && existingPlayer.height) {
      const heightScore = this.compareHeight(candidate.height, existingPlayer.height);
      totalScore += heightScore * weights.height;
      totalWeight += weights.height;
      if (heightScore >= 90) matchedFields.push('height');
    } else {
      totalWeight += weights.height;
    }

    // Phone comparison
    if (candidate.phone && existingPlayer.phone) {
      const phone1 = candidate.phone.replace(/\D/g, '');
      const phone2 = existingPlayer.phone.replace(/\D/g, '');
      const phoneScore = phone1 === phone2 ? 100 : 0;
      totalScore += phoneScore * weights.phone;
      totalWeight += weights.phone;
      if (phoneScore === 100) matchedFields.push('phone');
    } else {
      totalWeight += weights.phone;
    }

    // Date of birth comparison
    if (candidate.dateOfBirth && existingPlayer.dateOfBirth) {
      const dobScore =
        candidate.dateOfBirth.getTime() === existingPlayer.dateOfBirth.getTime() ? 100 : 0;
      totalScore += dobScore * weights.dateOfBirth;
      totalWeight += weights.dateOfBirth;
      if (dobScore === 100) matchedFields.push('dateOfBirth');
    } else {
      totalWeight += weights.dateOfBirth;
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return {
      score: finalScore,
      matchedFields,
    };
  }

  /**
   * Compare height strings (e.g., "6'5\"", "6-5", "77 inches")
   */
  private compareHeight(height1: string, height2: string): number {
    const normalizeHeight = (h: string): number | null => {
      // Try to extract inches
      const inchesMatch = h.match(/(\d+)\s*(?:inches?|in|"|'')/i);
      if (inchesMatch) {
        return parseInt(inchesMatch[1], 10);
      }

      // Try feet'inches" format
      const feetInchesMatch = h.match(/(\d+)['\s]*(\d+)?["\s]*/i);
      if (feetInchesMatch) {
        const feet = parseInt(feetInchesMatch[1], 10);
        const inches = feetInchesMatch[2] ? parseInt(feetInchesMatch[2], 10) : 0;
        return feet * 12 + inches;
      }

      // Try feet-inches format
      const dashMatch = h.match(/(\d+)[-\s]+(\d+)/);
      if (dashMatch) {
        const feet = parseInt(dashMatch[1], 10);
        const inches = parseInt(dashMatch[2], 10);
        return feet * 12 + inches;
      }

      return null;
    };

    const inches1 = normalizeHeight(height1);
    const inches2 = normalizeHeight(height2);

    if (inches1 === null || inches2 === null) {
      // Fallback to string similarity
      return StringSimilarity.compare(height1, height2);
    }

    // Allow 1 inch difference
    const difference = Math.abs(inches1 - inches2);
    if (difference === 0) return 100;
    if (difference <= 1) return 95;
    if (difference <= 2) return 85;
    return Math.max(0, 100 - difference * 10);
  }

  /**
   * Batch process multiple players and find duplicates
   */
  async findDuplicatesBatch(
    candidates: Array<{
      firstName: string;
      lastName: string;
      email?: string;
      height?: string;
      phone?: string;
      dateOfBirth?: Date;
    }>,
  ): Promise<Map<number, PlayerDeduplicationResult>> {
    const results = new Map<number, PlayerDeduplicationResult>();

    for (let i = 0; i < candidates.length; i++) {
      const result = await this.findDuplicatePlayer(candidates[i]);
      results.set(i, result);
    }

    return results;
  }
}

