import { Test, TestingModule } from '@nestjs/testing';
import { TournamentDivision } from '@prisma/client';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    tournament: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
    tournamentTeam: {
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw ConflictException if duplicate name and division', async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue({ id: 't1' });
      await expect(service.create({ name: 'League', division: TournamentDivision.PREMIER, startDate: '2026-01-01', numberOfGames: 10, quarterDuration: 10 })).rejects.toThrow(ConflictException);
    });

    it('should generate a code and create the tournament', async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue(null);
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);
      const tournament = { id: 't1', code: 'ABCDEF' };
      mockPrismaService.tournament.create.mockResolvedValue(tournament);

      const result = await service.create({ name: 'League', division: TournamentDivision.PREMIER, startDate: '2026-01-01', numberOfGames: 10, quarterDuration: 10 });
      expect(result).toEqual(tournament);
      expect(mockPrismaService.tournament.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if unable to generate unique code', async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue(null);
      mockPrismaService.tournament.findUnique.mockResolvedValue({}); // Always returns existing

      await expect(service.create({ name: 'League', division: TournamentDivision.PREMIER, startDate: '2026-01-01', numberOfGames: 10, quarterDuration: 10 })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all tournaments', async () => {
      mockPrismaService.tournament.findMany.mockResolvedValue([{ id: 't1' }]);
      const result = await service.findAll();
      expect(result).toEqual([{ id: 't1' }]);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if tournament is not found', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should return tournament if found', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      const result = await service.findOne('t1');
      expect(result).toEqual({ id: 't1' });
    });
  });

  describe('findByCode', () => {
    it('should return tournament by code', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      const result = await service.findByCode('ABCDEF');
      expect(result).toEqual({ id: 't1' });
    });

    it('should throw NotFoundException if not found by code', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);
      await expect(service.findByCode('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update the tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      mockPrismaService.tournament.update.mockResolvedValue({ id: 't1', name: 'New' });

      const result = await service.update('t1', { name: 'New' });
      expect(result.name).toBe('New');
    });
  });

  describe('addTeams', () => {
    it('should throw NotFoundException if one or more teams missing', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      mockPrismaService.team.findMany.mockResolvedValue([{ id: 'team1' }]); // requested team1, team2

      await expect(service.addTeams('t1', { teamIds: ['team1', 'team2'] })).rejects.toThrow(NotFoundException);
    });

    it('should upsert tournament teams', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      mockPrismaService.team.findMany.mockResolvedValue([{ id: 'team1' }, { id: 'team2' }]);
      
      await service.addTeams('t1', { teamIds: ['team1', 'team2'] });
      expect(mockPrismaService.tournamentTeam.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeTeam', () => {
    it('should remove team from tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      await service.removeTeam('t1', 'team1');
      expect(mockPrismaService.tournamentTeam.delete).toHaveBeenCalledWith({
        where: { tournamentId_teamId: { tournamentId: 't1', teamId: 'team1' } },
      });
    });
  });

  describe('updateFlyer', () => {
    it('should update flyer', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      await service.updateFlyer('t1', 'url');
      expect(mockPrismaService.tournament.update).toHaveBeenCalledWith(expect.objectContaining({ data: { flyer: 'url' } }));
    });
  });

  describe('remove', () => {
    it('should remove tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 't1' });
      await service.remove('t1');
      expect(mockPrismaService.tournament.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });
  });
});