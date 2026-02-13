import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { StringSimilarity } from "../utils/string-similarity.util";
import { Player } from "@prisma/client";

export enum MatchType {
  EXACT_MATCH = "EXACT_MATCH",
  POTENTIAL_DUPLICATE = "POTENTIAL_DUPLICATE",
  NO_MATCH = "NO_MATCH",
}

export interface PlayerDeduplicationResult {
  matchType: MatchType;
  existingPlayer: Player | null;
  similarityScore: number;
  isDuplicate: boolean; // Keep for backward compatibility if needed, but logic driven by matchType
  matchedFields: string[];
}

export interface PlayerDeduplicationCandidate {
  firstName: string;
  lastName: string;
  email?: string;
  height?: string;
  phone?: string;
  dateOfBirth?: Date;
  nationality?: string;
}

@Injectable()
export class PlayerDeduplicationService {
  private readonly logger = new Logger(PlayerDeduplicationService.name);
  private readonly FUZZY_THRESHOLD = 75.0; // Lowered threshold from 98.0

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find potential duplicate players based on multiple criteria
   * Step 1: Exact Match (Name + DOB)
   * Step 2: Fuzzy Match (Name, DOB, Nationality, etc.)
   */
  async findDuplicatePlayer(
    candidate: PlayerDeduplicationCandidate,
  ): Promise<PlayerDeduplicationResult> {
    const normalizedFirstName = StringSimilarity.normalize(candidate.firstName);
    const normalizedLastName = StringSimilarity.normalize(candidate.lastName);

    // --- STEP 1: EXACT MATCH CHECK ---
    if (candidate.dateOfBirth) {
      // Check for exact match on First Name, Last Name, and DOB
      // We use findMany to catch case-insensitive matches if collation allows, or filter in app
      // Prisma's case-insensitive mode is useful here.
      const exactMatches = await this.prisma.player.findMany({
        where: {
          firstName: { equals: candidate.firstName, mode: "insensitive" },
          lastName: { equals: candidate.lastName, mode: "insensitive" },
          dateOfBirth: candidate.dateOfBirth,
        },
        take: 1,
      });

      if (exactMatches.length > 0) {
        const exactMatch = exactMatches[0];
        this.logger.log(`Exact match found: ${exactMatch.id}`);
        return {
          matchType: MatchType.EXACT_MATCH,
          existingPlayer: exactMatch,
          similarityScore: 100,
          isDuplicate: true,
          matchedFields: ["firstName", "lastName", "dateOfBirth"],
        };
      }
    }

    // --- STEP 2: FUZZY MATCH CHECK ---
    // Fetch candidates: loose filter to reduce set
    // Fetch players where lastName starts with first 2 chars OR firstName starts with first 2 chars
    // This optimization prevents scanning the entire table.
    const candidates = await this.prisma.player.findMany({
      where: {
        OR: [
          {
            lastName: {
              startsWith: candidate.lastName.substring(0, 2),
              mode: "insensitive",
            },
          },
          {
            firstName: {
              startsWith: candidate.firstName.substring(0, 2),
              mode: "insensitive",
            },
          },
          // Also check by email if provided
          candidate.email
            ? { email: { equals: candidate.email, mode: "insensitive" } }
            : {},
        ],
      },
    });

    let bestMatch: { player: Player; score: number; fields: string[] } | null =
      null;

    for (const player of candidates) {
      const similarity = this.calculatePlayerSimilarity(candidate, player);

      if (similarity.score >= this.FUZZY_THRESHOLD) {
        if (!bestMatch || similarity.score > bestMatch.score) {
          bestMatch = {
            player,
            score: similarity.score,
            fields: similarity.matchedFields,
          };
        }
      }
    }

    if (bestMatch) {
      this.logger.warn(
        `Potential duplicate found: ${bestMatch.player.id} (${bestMatch.score.toFixed(2)}% match)`,
      );
      return {
        matchType: MatchType.POTENTIAL_DUPLICATE,
        existingPlayer: bestMatch.player,
        similarityScore: bestMatch.score,
        isDuplicate: true, // Flag as duplicate for potential handling
        matchedFields: bestMatch.fields,
      };
    }

    // --- STEP 3: NO MATCH ---
    return {
      matchType: MatchType.NO_MATCH,
      existingPlayer: null,
      similarityScore: 0,
      isDuplicate: false,
      matchedFields: [],
    };
  }

  /**
   * Calculate comprehensive similarity score
   */
  private calculatePlayerSimilarity(
    candidate: {
      firstName: string;
      lastName: string;
      email?: string;
      height?: string;
      phone?: string;
      dateOfBirth?: Date;
      nationality?: string;
    },
    existingPlayer: Player,
  ): { score: number; matchedFields: string[] } {
    const weights = {
      firstName: 20,
      lastName: 20,
      dob: 20,
      nationality: 15,
      height: 10,
      email: 10,
      phone: 5,
    };

    let totalScore = 0;
    let totalWeight = 0;
    const matchedFields: string[] = [];

    // First Name
    const fnScore = StringSimilarity.compare(
      candidate.firstName,
      existingPlayer.firstName,
    );
    totalScore += fnScore * weights.firstName;
    totalWeight += weights.firstName;
    if (fnScore >= 90) matchedFields.push("firstName");

    // Last Name
    const lnScore = StringSimilarity.compare(
      candidate.lastName,
      existingPlayer.lastName,
    );
    totalScore += lnScore * weights.lastName;
    totalWeight += weights.lastName;
    if (lnScore >= 90) matchedFields.push("lastName");

    // Date of Birth
    if (candidate.dateOfBirth && existingPlayer.dateOfBirth) {
      const d1 = new Date(candidate.dateOfBirth);
      const d2 = new Date(existingPlayer.dateOfBirth);
      if (d1.getTime() === d2.getTime()) {
        totalScore += 100 * weights.dob;
        matchedFields.push("dateOfBirth");
      } else if (d1.getFullYear() === d2.getFullYear()) {
        // Same year = partial match
        totalScore += 50 * weights.dob;
        matchedFields.push("birthYear");
      }
      totalWeight += weights.dob;
    } else {
      totalWeight += weights.dob;
    }

    // Nationality
    if (candidate.nationality && (existingPlayer as any).nationality) {
      const natScore = StringSimilarity.compare(
        candidate.nationality,
        (existingPlayer as any).nationality,
      );
      totalScore += natScore * weights.nationality;
      matchedFields.push("nationality"); // Count as checked
      if (natScore >= 90) matchedFields.push("nationality_match");
      totalWeight += weights.nationality;
    } else {
      // If missing, don't penalize heavily or treat as neutral?
      // Let's treat as neutral (remove from weight denominator or keep?)
      // Requirement implies it's a key factor. Let's keep weight.
      totalWeight += weights.nationality;
    }

    // Email
    if (candidate.email && existingPlayer.email) {
      const e1 = candidate.email.toLowerCase();
      const e2 = existingPlayer.email.toLowerCase();
      const eScore = e1 === e2 ? 100 : 0;
      totalScore += eScore * weights.email;
      if (eScore === 100) matchedFields.push("email");
      totalWeight += weights.email;
    } else {
      totalWeight += weights.email;
    }

    // Height
    if (candidate.height && existingPlayer.height) {
      const hScore = this.compareHeight(
        candidate.height,
        existingPlayer.height,
      );
      totalScore += hScore * weights.height;
      if (hScore >= 90) matchedFields.push("height");
      totalWeight += weights.height;
    } else {
      totalWeight += weights.height;
    }

    // Phone
    if (candidate.phone && existingPlayer.phone) {
      const pScore =
        candidate.phone.replace(/\D/g, "") ===
        existingPlayer.phone.replace(/\D/g, "")
          ? 100
          : 0;
      totalScore += pScore * weights.phone;
      if (pScore === 100) matchedFields.push("phone");
      totalWeight += weights.phone;
    } else {
      totalWeight += weights.phone;
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return { score: finalScore, matchedFields };
  }

  private compareHeight(height1: string, height2: string): number {
    // Reuse existing logic from previous version or simplified
    const normalizeHeight = (h: string): number | null => {
      const inchesMatch = h.match(/(\d+)\s*(?:inches?|in|"|'')/i);
      if (inchesMatch) return parseInt(inchesMatch[1], 10);
      const feetInchesMatch = h.match(/(\d+)['\s]*(\d+)?["\s]*/i);
      if (feetInchesMatch)
        return (
          parseInt(feetInchesMatch[1], 10) * 12 +
          parseInt(feetInchesMatch[2] || "0", 10)
        );
      return null;
    };

    const h1 = normalizeHeight(height1);
    const h2 = normalizeHeight(height2);
    if (h1 && h2) {
      const diff = Math.abs(h1 - h2);
      if (diff <= 1) return 100;
      if (diff <= 3) return 80;
      return 0;
    }
    return StringSimilarity.compare(height1, height2);
  }

  async findDuplicatesBatch(
    candidates: any[],
  ): Promise<Map<number, PlayerDeduplicationResult>> {
    const results = new Map<number, PlayerDeduplicationResult>();
    for (let i = 0; i < candidates.length; i++) {
      results.set(i, await this.findDuplicatePlayer(candidates[i]));
    }
    return results;
  }
}
