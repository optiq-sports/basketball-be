import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatdashProjectionsService } from '../statdash/projections/statdash-projections.service';
import { StatdashRealtimeService } from '../statdash/realtime/statdash-realtime.service';
import { map } from 'rxjs/operators';
import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ClientApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statdashProjectionsService: StatdashProjectionsService,
    private readonly statdashRealtimeService: StatdashRealtimeService,
  ) {}

  async getMatches(clientId: string | undefined) {
    if (!clientId) throw new NotFoundException('Client ID is missing');
    return this.prisma.match.findMany({
      where: { clientId },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { id: true, name: true, code: true } },
        awayTeam: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getMatchDetails(clientId: string | undefined, matchId: string) {
    if (!clientId) throw new NotFoundException('Client ID is missing');
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, clientId },
      include: {
        homeTeam: true,
        awayTeam: true,
        gameSessions: {
          select: { id: true, status: true, quarter: true, clockSecondsRemaining: true },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  private async getSessionForMatch(clientId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, clientId },
      include: { gameSessions: true },
    });

    if (!match || !match.gameSessions) {
      throw new NotFoundException('Match or session not found');
    }

    return match.gameSessions;
  }

  async getBoxScore(clientId: string | undefined, matchId: string) {
    if (!clientId) throw new NotFoundException('Client ID is missing');
    const session = await this.getSessionForMatch(clientId, matchId);
    
    // Call the internal projections service (which calculates all stats)
    const boxScore = await this.statdashProjectionsService.getBoxScore(session.id);
    
    // Optionally remove any advanced analytics here if they were present
    return boxScore;
  }

  async getShotChart(clientId: string | undefined, matchId: string) {
    if (!clientId) throw new NotFoundException('Client ID is missing');
    const session = await this.getSessionForMatch(clientId, matchId);
    
    // Call internal service
    const rawShotChart = await this.statdashProjectionsService.getShotChart(session.id);
    
    // Data Privacy: Strip out advanced stats (x, y coordinates)
    return rawShotChart.map(shot => {
      // Create a shallow copy without x and y
      const { x, y, ...publicShot } = shot as Record<string, unknown>;
      return publicShot;
    });
  }

  async streamMatch(clientId: string | undefined, matchId: string, sinceVersion?: number): Promise<Observable<MessageEvent>> {
    if (!clientId) throw new NotFoundException('Client ID is missing');
    const session = await this.getSessionForMatch(clientId, matchId);

    // Call the internal real-time streaming service
    const stream = this.statdashRealtimeService.streamBySession(session.id, sinceVersion);

    // Map over the stream to strip out sensitive properties (like x, y in deltaEvents)
    return stream.pipe(
      map((event: MessageEvent) => {
        if (event.type === 'statdash-update' && event.data && typeof event.data === 'object') {
          const data = event.data as { deltaEvents?: Record<string, unknown>[] };
          if (Array.isArray(data.deltaEvents)) {
            data.deltaEvents = data.deltaEvents.map((deltaEvent) => {
              const { x, y, ...publicEvent } = deltaEvent;
              return publicEvent;
            });
          }
        }
        return event;
      })
    );
  }
}


