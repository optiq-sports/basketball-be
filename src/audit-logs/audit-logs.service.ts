import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, Role } from "@prisma/client";
import { AuditLogFilterDto } from "./dto/audit-log-filter.dto";
import {
  PageMetaDto,
  PaginatedResponseDto,
} from "../common/dto/paginated-response.dto";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { AuditLogResponseDto } from "./dto/audit-log-response.dto";
import { buildPrismaPagination } from "../common/utils/pagination.util";

export interface CreateAuditLogInput {
  actorUserId: string;
  actorRole: string;
  clientId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordLog(
    clientOrTx: Prisma.TransactionClient | PrismaService,
    input: CreateAuditLogInput,
  ) {
    return clientOrTx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        clientId: input.clientId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before:
          input.before !== undefined
            ? (input.before as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        after:
          input.after !== undefined
            ? (input.after as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filterDto: AuditLogFilterDto,
  ): Promise<PaginatedResponseDto<AuditLogResponseDto>> {
    const {
      entityType,
      action,
      actorUserId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filterDto;

    const where: Prisma.AuditLogWhereInput = {};

    if (user.role === Role.ADMIN) {
      const clientId = user.clientIds?.[0];
      if (!clientId) {
        throw new ForbiddenException("Admin user has no associated client");
      }
      where.clientId = clientId;
    }

    if (entityType) {
      where.entityType = { equals: entityType, mode: "insensitive" };
    }
    if (action) {
      where.action = { equals: action, mode: "insensitive" };
    }
    if (actorUserId) {
      where.actorUserId = actorUserId;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const { skip, take, orderBy } = buildPrismaPagination(filterDto, {
      defaultOrderBy: { createdAt: "desc" },
    });

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({
      page,
      limit: take,
      itemCount: total,
    });

    return new PaginatedResponseDto(logs, pageMetaDto);
  }
}
