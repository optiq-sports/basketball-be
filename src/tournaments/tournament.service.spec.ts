import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsService } from "./tournaments.service";
import { PrismaService } from "../prisma/prisma.service";
import { Tournament } from "@prisma/client";

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    tournament: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more tests for the TournamentsService methods here
});