import { Injectable } from "@nestjs/common";
import {
  GameEvent,
  GameSession,
  GameSessionStatus,
  IdempotencyRecord,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class StatdashSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSession(data: {
    matchId: string;
    status?: GameSessionStatus;
    homeOnLeft: boolean;
    homeAttacksLeft: boolean;
  }): Promise<GameSession> {
    return this.prisma.gameSession.create({
      data: {
        matchId: data.matchId,
        status: data.status ?? GameSessionStatus.PENDING,
        homeOnLeft: data.homeOnLeft,
        homeAttacksLeft: data.homeAttacksLeft,
      },
    });
  }

  findSessionById(sessionId: string): Promise<GameSession | null> {
    return this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
  }

  appendEvent(data: Prisma.GameEventUncheckedCreateInput): Promise<GameEvent> {
    return this.prisma.gameEvent.create({ data });
  }

  saveIdempotencyRecord(
    data: Prisma.IdempotencyRecordUncheckedCreateInput,
  ): Promise<IdempotencyRecord> {
    return this.prisma.idempotencyRecord.create({ data });
  }
}
