import { Test, TestingModule } from '@nestjs/testing';
import { ClientApiService } from './client-api.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatdashProjectionsService } from '../statdash/projections/statdash-projections.service';
import { StatdashRealtimeService } from '../statdash/realtime/statdash-realtime.service';
import { NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';

describe('ClientApiService', () => {
  let service: ClientApiService;
  let prisma: PrismaService;
  let projectionsService: StatdashProjectionsService;
  let realtimeService: StatdashRealtimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientApiService,
        {
          provide: PrismaService,
          useValue: {
            match: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: StatdashProjectionsService,
          useValue: {
            getBoxScore: jest.fn(),
            getShotChart: jest.fn(),
          },
        },
        {
          provide: StatdashRealtimeService,
          useValue: {
            streamBySession: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClientApiService>(ClientApiService);
    prisma = module.get<PrismaService>(PrismaService);
    projectionsService = module.get<StatdashProjectionsService>(StatdashProjectionsService);
    realtimeService = module.get<StatdashRealtimeService>(StatdashRealtimeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMatches', () => {
    it('should throw if clientId is missing', async () => {
      await expect(service.getMatches(undefined)).rejects.toThrow(NotFoundException);
    });

    it('should return matches for a client', async () => {
      const mockMatches = [{ id: 'match1' }, { id: 'match2' }];
      (prisma.match.findMany as jest.Mock).mockResolvedValue(mockMatches);

      const result = await service.getMatches('client1');
      expect(result).toEqual(mockMatches);
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: { clientId: 'client1' },
        select: expect.any(Object),
      });
    });
  });

  describe('getMatchDetails', () => {
    it('should throw if clientId is missing', async () => {
      await expect(service.getMatchDetails(undefined, 'match1')).rejects.toThrow(NotFoundException);
    });

    it('should throw if match not found', async () => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.getMatchDetails('client1', 'match1')).rejects.toThrow(NotFoundException);
    });

    it('should return match details', async () => {
      const mockMatch = { id: 'match1', homeTeam: {}, awayTeam: {} };
      (prisma.match.findFirst as jest.Mock).mockResolvedValue(mockMatch);

      const result = await service.getMatchDetails('client1', 'match1');
      expect(result).toEqual(mockMatch);
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: { id: 'match1', clientId: 'client1' },
        include: expect.any(Object),
      });
    });
  });

  describe('getShotChart (Data Privacy)', () => {
    it('should strip out advanced stats (x, y coordinates)', async () => {
      // Mock getSessionForMatch implicitly via prisma
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: 'match1',
        gameSessions: { id: 'session1' },
      });

      const rawShotChart = [
        { id: 'shot1', type: 'MAKE', points: 2, x: 10, y: 20 },
        { id: 'shot2', type: 'MISS', points: 3, x: 50, y: 80 },
      ];
      
      (projectionsService.getShotChart as jest.Mock).mockResolvedValue(rawShotChart);

      const result = await service.getShotChart('client1', 'match1');

      expect(result).toEqual([
        { id: 'shot1', type: 'MAKE', points: 2 },
        { id: 'shot2', type: 'MISS', points: 3 },
      ]);
    });
  });

  describe('streamMatch (Data Privacy)', () => {
    it('should strip x, y coordinates from real-time delta events', (done) => {
      (prisma.match.findFirst as jest.Mock).mockResolvedValue({
        id: 'match1',
        gameSessions: { id: 'session1' },
      });

      const mockEvent = {
        type: 'statdash-update',
        data: {
          deltaEvents: [
            { id: 'event1', eventType: 'SHOT', x: 100, y: 200, points: 2 },
            { id: 'event2', eventType: 'FOUL', player: 'p1' },
          ],
        },
      };

      (realtimeService.streamBySession as jest.Mock).mockReturnValue(of(mockEvent));

      service.streamMatch('client1', 'match1').then((stream) => {
        stream.subscribe((event) => {
          const data = event.data as any;
          expect(data.deltaEvents).toEqual([
            { id: 'event1', eventType: 'SHOT', points: 2 },
            { id: 'event2', eventType: 'FOUL', player: 'p1' },
          ]);
          done();
        });
      });
    });
  });
});
