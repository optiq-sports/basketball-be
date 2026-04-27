import { BadRequestException } from "@nestjs/common";

export type LineupSnapshot = {
  homeLineup: string[];
  awayLineup: string[];
};

export function validateOnCourtPlayer(
  lineup: LineupSnapshot | null,
  playerId: string,
  messageCode: string,
) {
  if (!lineup) {
    return;
  }

  const active = new Set([...lineup.homeLineup, ...lineup.awayLineup]);
  if (!active.has(playerId)) {
    throw new BadRequestException({
      code: messageCode,
      message: `Player ${playerId} is not on court`,
    });
  }
}
