import { Test, TestingModule } from "@nestjs/testing";
import { QueueController } from "./queue.controller";
import { QueueService } from "./queue.service";

describe("QueueController", () => {
  let controller: QueueController;
  let service: QueueService;

  const mockQueueService = {
    getQueueHealth: jest.fn(),
    getQueueLagMetrics: jest.fn(),
    getDeadLetterJobs: jest.fn(),
    requeueDeadLetterJobs: jest.fn(),
    warmSessionCaches: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    controller = module.get<QueueController>(QueueController);
    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getQueueHealth", () => {
    it("should return queue health from service", async () => {
      const mockHealth = { enabled: true, queues: {} };
      mockQueueService.getQueueHealth.mockResolvedValue(mockHealth);

      const result = await controller.getQueueHealth();
      expect(service.getQueueHealth).toHaveBeenCalled();
      expect(result).toBe(mockHealth);
    });
  });

  describe("getDeadLetterJobs", () => {
    it("should return dead letter jobs from service with query parameters", async () => {
      const mockDlqResponse = {
        enabled: true,
        total: 1,
        jobs: [
          {
            id: "1",
            name: "dlq.recovery",
            timestamp: 1729000000000,
            failedReason: "Connection refused",
            attemptsMade: 3,
            data: { sessionId: "s1" },
          },
        ],
      };
      mockQueueService.getDeadLetterJobs.mockResolvedValue(mockDlqResponse);

      const result = await controller.getDeadLetterJobs({
        limit: 10,
        offset: 5,
      });
      expect(service.getDeadLetterJobs).toHaveBeenCalledWith(10, 5);
      expect(result).toBe(mockDlqResponse);
    });
  });

  describe("requeueDeadLetterJobs", () => {
    it("should call requeueDeadLetterJobs with limit", async () => {
      mockQueueService.requeueDeadLetterJobs.mockResolvedValue({ requeued: 5 });

      const result = await controller.requeueDeadLetterJobs({ limit: "5" });
      expect(service.requeueDeadLetterJobs).toHaveBeenCalledWith(5);
      expect(result).toEqual({ requeued: 5 });
    });
  });
});
