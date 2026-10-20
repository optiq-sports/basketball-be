import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogsController } from "./audit-logs.controller";
import { AuditLogsService } from "./audit-logs.service";
import { Role } from "@prisma/client";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { AuditLogFilterDto } from "./dto/audit-log-filter.dto";

describe("AuditLogsController", () => {
  let controller: AuditLogsController;
  let service: AuditLogsService;

  const mockAuditLogsService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogsController>(AuditLogsController);
    service = module.get<AuditLogsService>(AuditLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should forward user and query to service.findAll", async () => {
      const mockUser: AuthenticatedUser = {
        id: "user-1",
        email: "user@test.com",
        name: "Test User",
        role: Role.SUPER_ADMIN,
      };

      const query: AuditLogFilterDto = {
        entityType: "tournament",
        action: "DELETE",
        page: 1,
        limit: 10,
      };

      const expectedResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockAuditLogsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockUser, query);

      expect(result).toBe(expectedResult);
      expect(mockAuditLogsService.findAll).toHaveBeenCalledWith(
        mockUser,
        query,
      );
    });
  });
});
