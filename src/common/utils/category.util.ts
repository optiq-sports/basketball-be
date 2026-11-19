import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Category, Gender, Role } from "@prisma/client";
import { AuthenticatedUser } from "../interfaces/user.interface";

export type MismatchApprovalRecord = {
  mismatchApproved: boolean;
  mismatchApprovedById: string | null;
  mismatchApprovedAt: Date | null;
  mismatchReason: string | null;
};

/**
 * Normalizes a gender string (e.g. from spreadsheet upload) to Prisma Gender enum.
 */
export function parseGenderValue(raw: unknown): Gender | undefined {
  if (raw === undefined || raw === null) return undefined;
  const normalized = String(raw).trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized === "MALE" || normalized === "M") return Gender.MALE;
  if (normalized === "FEMALE" || normalized === "F") return Gender.FEMALE;
  return undefined;
}

/**
 * Checks whether a team's category is compatible with a tournament's category.
 */
export function isTeamCompatibleWithTournament(
  teamCategory?: Category | null,
  tournamentCategory?: Category | null,
): boolean {
  if (!tournamentCategory || tournamentCategory === Category.MIXED) {
    return true;
  }
  if (!teamCategory) {
    return true;
  }
  return teamCategory === tournamentCategory;
}

/**
 * Checks whether two teams are compatible for a match fixture (and with the tournament).
 */
export function checkMatchCategoryCompatibility(
  homeCategory?: Category | null,
  awayCategory?: Category | null,
  tournamentCategory?: Category | null,
): { compatible: boolean; code?: string; message?: string } {
  if (
    tournamentCategory &&
    tournamentCategory !== Category.MIXED &&
    ((homeCategory && homeCategory !== tournamentCategory) ||
      (awayCategory && awayCategory !== tournamentCategory))
  ) {
    return {
      compatible: false,
      code: "MATCH_TOURNAMENT_CATEGORY_MISMATCH",
      message: `Team category does not match tournament category (${tournamentCategory})`,
    };
  }

  if (homeCategory && awayCategory && homeCategory !== awayCategory) {
    return {
      compatible: false,
      code: "MATCH_TEAM_CATEGORY_MISMATCH",
      message: `Home team (${homeCategory}) and away team (${awayCategory}) categories do not match`,
    };
  }

  return { compatible: true };
}

/**
 * Checks whether a player's gender is compatible with a team's category.
 * Players without a recorded gender pass by default.
 */
export function isPlayerCompatibleWithTeam(
  playerGender?: Gender | null,
  teamCategory?: Category | null,
): boolean {
  if (!playerGender || !teamCategory || teamCategory === Category.MIXED) {
    return true;
  }
  if (playerGender === Gender.MALE && teamCategory === Category.MEN) {
    return true;
  }
  if (playerGender === Gender.FEMALE && teamCategory === Category.WOMEN) {
    return true;
  }
  return false;
}

/**
 * Validates and builds mismatch approval metadata, or throws a structured error.
 */
export function resolveMismatchApproval(params: {
  approveMismatch?: boolean;
  mismatchReason?: string;
  user?: AuthenticatedUser;
  code: string;
  message: string;
}): MismatchApprovalRecord {
  if (!params.approveMismatch) {
    throw new BadRequestException({
      code: params.code,
      message: params.message,
    });
  }

  if (
    !params.user ||
    (params.user.role !== Role.ADMIN && params.user.role !== Role.SUPER_ADMIN)
  ) {
    throw new ForbiddenException({
      code: "CATEGORY_MISMATCH_APPROVAL_FORBIDDEN",
      message:
        "Only ADMIN or SUPER_ADMIN can approve a category or gender mismatch",
    });
  }

  const reason = params.mismatchReason?.trim();
  if (!reason) {
    throw new BadRequestException({
      code: "CATEGORY_MISMATCH_REASON_REQUIRED",
      message: "mismatchReason is required when approveMismatch is true",
    });
  }

  return {
    mismatchApproved: true,
    mismatchApprovedById: params.user.id,
    mismatchApprovedAt: new Date(),
    mismatchReason: reason,
  };
}
