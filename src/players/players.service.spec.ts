import { Test, TestingModule } from '@nestjs/testing';
import { PlayersService } from './players.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerDeduplicationService } from '../common/services/player-deduplication.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('PlayersService', () => {
  let service: PlayersService;
  let prisma: PrismaService;
  let deduplicationService: PlayerDeduplicationService;

  const mockPrismaService = {
    player: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    playerTeam: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDeduplicationService = {
    findDuplicatePlayer: jest.fn(),
    findDuplicatesBatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlayerDeduplicationService,
          useValue: mockDeduplicationService,
        },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
    prisma = module.get<PrismaService>(PrismaService);
    deduplicationService = module.get<PlayerDeduplicationService>(PlayerDeduplicationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new player successfully', async () => {
      const createPlayerDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        isDuplicate: false,
        existingPlayer: null,
        similarityScore: 0,
      });

      mockPrismaService.player.findUnique.mockResolvedValue(null);
      mockPrismaService.player.create.mockResolvedValue({
        id: 'player1',
        ...createPlayerDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createPlayerDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.player.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if duplicate player found', async () => {
      const createPlayerDto = {
        firstName: 'John',
        lastName: 'Doe',
      };

      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        isDuplicate: true,
        existingPlayer: { id: 'existing1', firstName: 'John', lastName: 'Doe' },
        similarityScore: 98.5,
      });

      await expect(service.create(createPlayerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('createForTeam', () => {
    it('should create player and assign to team', async () => {
      const createDto = {
        teamId: 'team1',
        firstName: 'John',
        lastName: 'Doe',
        jerseyNumber: 23,
      };

      mockPrismaService.team.findUnique.mockResolvedValue({ id: 'team1', name: 'Lakers' });
      mockPrismaService.playerTeam.findFirst.mockResolvedValue(null);
      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        isDuplicate: false,
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          player: {
            create: jest.fn().mockResolvedValue({
              id: 'player1',
              firstName: 'John',
              lastName: 'Doe',
            }),
            findUnique: jest.fn().mockResolvedValue(null),
          },
          playerTeam: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.createForTeam(createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if team does not exist', async () => {
      const createDto = {
        teamId: 'invalid',
        firstName: 'John',
        lastName: 'Doe',
        jerseyNumber: 23,
      };

      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.createForTeam(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkCreateForTeam', () => {
    it('should create multiple players with deduplication', async () => {
      const bulkDto = {
        teamId: 'team1',
        players: [
          { firstName: 'John', lastName: 'Doe', jerseyNumber: 23 },
          { firstName: 'Jane', lastName: 'Smith', jerseyNumber: 24 },
        ],
      };

      mockPrismaService.team.findUnique.mockResolvedValue({ id: 'team1' });
      mockPrismaService.playerTeam.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicatePlayer.mockResolvedValue({
        isDuplicate: false,
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          player: {
            create: jest.fn().mockResolvedValue({ id: 'player1', firstName: 'John', lastName: 'Doe' }),
            findUnique: jest.fn().mockResolvedValue(null),
          },
          playerTeam: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.bulkCreateForTeam(bulkDto);

      expect(result).toBeDefined();
      expect(result.created).toBeGreaterThan(0);
    });
  });

  describe('findOne', () => {
    it('should return player if found', async () => {
      const playerId = 'player1';
      const mockPlayer = {
        id: playerId,
        firstName: 'John',
        lastName: 'Doe',
        playerTeams: [],
        matchStats: [],
      };

      mockPrismaService.player.findUnique.mockResolvedValue(mockPlayer);

      const result = await service.findOne(playerId);

      expect(result).toBeDefined();
      expect(result.id).toBe(playerId);
    });

    it('should throw NotFoundException if player not found', async () => {
      mockPrismaService.player.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});

