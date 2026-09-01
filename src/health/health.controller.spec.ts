import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";

describe("HealthController", () => {
  let controller: HealthController;
  let health: HealthCheckService;
  let prisma: PrismaService;
  let redis: RedisService;
  let memory: MemoryHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockImplementation((indicators) => {
              return Promise.all(
                indicators.map((indicator: any) => indicator()),
              );
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            checkHealth: jest.fn(),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkRSS: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    health = module.get<HealthCheckService>(HealthCheckService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    memory = module.get<MemoryHealthIndicator>(MemoryHealthIndicator);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should return up status when all checks pass", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([1]);
    (redis.checkHealth as jest.Mock).mockResolvedValueOnce(true);
    (memory.checkRSS as jest.Mock).mockResolvedValueOnce({
      memory_rss: { status: "up" },
    });

    const result = await controller.check();
    expect(result).toEqual([
      { database: { status: "up" } },
      { redis: { status: "up" } },
      { memory_rss: { status: "up" } },
    ]);
  });

  it("should throw HealthCheckError when DB is down", async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(
      new Error("Connection failed"),
    );
    (redis.checkHealth as jest.Mock).mockResolvedValueOnce(true);
    (memory.checkRSS as jest.Mock).mockResolvedValueOnce({
      memory_rss: { status: "up" },
    });

    await expect(controller.check()).rejects.toThrow("Database check failed");
  });

  it("should throw HealthCheckError when Redis is down", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([1]);
    (redis.checkHealth as jest.Mock).mockResolvedValueOnce(false);
    (memory.checkRSS as jest.Mock).mockResolvedValueOnce({
      memory_rss: { status: "up" },
    });

    await expect(controller.check()).rejects.toThrow("Redis check failed");
  });
});
