import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CreateClientDto } from "./dto/create-client.dto";
import { CreateEmbedTokenDto } from "./dto/create-embed-token.dto";
import { AssignUserDto } from "./dto/assign-user.dto";
import { ClientFilterDto } from "./dto/client-filter.dto";
import * as crypto from "crypto";
import { AuthenticatedUser } from "src/common/interfaces/user.interface";
import { EmailService } from "../notifications/email.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import * as bcrypt from "bcrypt";
import { Prisma, Role } from "@prisma/client";

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private checkClientAccess(user: AuthenticatedUser, clientId: string) {
    if (user.role !== "SUPER_ADMIN") {
      if (!user.clientIds?.includes(clientId)) {
        throw new ForbiddenException("Not authorized for this client");
      }
    }
  }

  async getMyClient(user: AuthenticatedUser) {
    const clientId = user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        slug: true,
        clientType: true,
        websiteUrl: true,
        logo: true,
      },
    });

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    return client;
  }

  async createApiKey(
    user: AuthenticatedUser,
    createApiKeyDto: CreateApiKeyDto,
  ) {
    const { clientId, name } = createApiKeyDto;

    this.checkClientAccess(user, clientId);

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    // Generate a secure random string for the API key
    const rawKey = crypto.randomBytes(32).toString("hex");
    const apiKey = `optiq_${rawKey}`;

    // Hash the key for storage
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Scopes are settable at creation by SUPER_ADMIN; for other callers, default to empty array
    const scopes =
      user.role === Role.SUPER_ADMIN && createApiKeyDto.scopes
        ? createApiKeyDto.scopes
        : [];

    const createdKey = await this.prisma.$transaction(async (tx) => {
      const key = await tx.clientApiKey.create({
        data: {
          clientId,
          name,
          keyHash,
          scopes,
        },
      });
      await this.auditLogsService.recordLog(tx, {
        actorUserId: user.id,
        actorRole: user.role,
        clientId,
        action: "CREATE_API_KEY",
        entityType: "client_api_key",
        entityId: key.id,
        after: { id: key.id, name: key.name, clientId, scopes: key.scopes },
      });
      return key;
    });

    return {
      id: createdKey.id,
      name: createdKey.name,
      clientId: createdKey.clientId,
      apiKey, // Return this ONCE
      scopes: createdKey.scopes,
      createdAt: createdKey.createdAt,
    };
  }

  async listApiKeys(user: AuthenticatedUser, clientId: string) {
    this.checkClientAccess(user, clientId);

    return this.prisma.clientApiKey.findMany({
      where: { clientId },
      select: {
        id: true,
        name: true,
        clientId: true,
        scopes: true,
        createdAt: true,
        lastUsed: true,
      },
    });
  }

  async revokeApiKey(user: AuthenticatedUser, id: string) {
    const apiKey = await this.prisma.clientApiKey.findUnique({ where: { id } });
    if (!apiKey) throw new NotFoundException("API Key not found");

    this.checkClientAccess(user, apiKey.clientId);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.clientApiKey.delete({
        where: { id },
      });
      await this.auditLogsService.recordLog(tx, {
        actorUserId: user.id,
        actorRole: user.role,
        clientId: apiKey.clientId,
        action: "REVOKE_API_KEY",
        entityType: "client_api_key",
        entityId: id,
        before: apiKey,
      });
      return deleted;
    });
  }

  async createClient(createClientDto: CreateClientDto) {
    const { userEmail, userFirstName, userLastName, ...clientData } =
      createClientDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (existingUser) {
      throw new ConflictException("A user with this email already exists");
    }

    // Auto-generate password
    const plainTextPassword = Math.random().toString(36).slice(-10) + "Aa1!";
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    const newClient = await this.prisma.$transaction(async (prisma) => {
      // 1. Create the Client Organization
      const createdClient = await prisma.client.create({
        data: clientData,
      });

      // 2. Create the User (and UserProfile)
      const fullName = `${userFirstName} ${userLastName}`;
      const user = await prisma.user.create({
        data: {
          email: userEmail,
          password: hashedPassword,
          name: fullName,
          role: Role.CLIENT,
          forcePasswordChange: true,
          profile: {
            create: {
              fullName,
              email: userEmail,
            },
          },
        },
      });

      // 3. Link them via ClientUser
      await prisma.clientUser.create({
        data: {
          clientId: createdClient.id,
          userId: user.id,
        },
      });

      return createdClient;
    });

    // Send welcome email; return emailSent flag without aborting creation on failure
    const emailSent = await this.emailService.sendWelcomeEmail(
      userEmail,
      plainTextPassword,
      Role.CLIENT,
    );

    return { ...newClient, emailSent: Boolean(emailSent) };
  }

  async listClients(filterDto?: ClientFilterDto) {
    const { page = 1, limit = 10, search } = filterDto || {};
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = search
      ? { name: { contains: search, mode: "insensitive" } }
      : {};

    const [data, itemCount] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    const { PageMetaDto, PaginatedResponseDto } =
      await import("../common/dto/paginated-response.dto");
    return new PaginatedResponseDto(
      data,
      new PageMetaDto({ page, limit, itemCount }),
    );
  }

  async listClientUsers(user: AuthenticatedUser, clientId: string) {
    this.checkClientAccess(user, clientId);

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException("Client not found");
    }

    const clientUsers = await this.prisma.clientUser.findMany({
      where: { clientId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return clientUsers.map((cu) => cu.user);
  }

  async unlinkUserFromClient(
    clientId: string,
    userId: string,
    actorUser?: AuthenticatedUser,
  ) {
    if (actorUser) {
      this.checkClientAccess(actorUser, clientId);
    }

    const clientUser = await this.prisma.clientUser.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId,
        },
      },
    });

    if (!clientUser) {
      throw new NotFoundException("User is not linked to this client");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.clientUser.delete({
        where: {
          clientId_userId: {
            clientId,
            userId,
          },
        },
      });
      await this.auditLogsService.recordLog(tx, {
        actorUserId: actorUser?.id || "system",
        actorRole: actorUser?.role || "ADMIN",
        clientId,
        action: "UNASSIGN_USER",
        entityType: "client_user",
        entityId: `${clientId}_${userId}`,
        before: clientUser,
      });
    });

    return { success: true, message: "User unlinked from client successfully" };
  }

  async assignUserToClient(
    clientId: string,
    dto: AssignUserDto,
    actorUser?: AuthenticatedUser,
  ) {
    if (actorUser) {
      this.checkClientAccess(actorUser, clientId);
    }

    const { userId } = dto;

    // Ensure client exists
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException("Client not found");
    }

    // Ensure user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === Role.SUPER_ADMIN) {
      throw new BadRequestException("Cannot assign SUPER_ADMIN as client user");
    }

    return this.prisma.$transaction(async (tx) => {
      // Preserve existing user role (e.g. ADMIN, STATISTICIAN) rather than demoting to CLIENT
      // Check if already assigned
      const existing = await tx.clientUser.findUnique({
        where: {
          clientId_userId: {
            clientId,
            userId,
          },
        },
      });

      if (existing) {
        return existing;
      }

      const created = await tx.clientUser.create({
        data: {
          clientId,
          userId,
        },
      });

      await this.auditLogsService.recordLog(tx, {
        actorUserId: actorUser?.id || "system",
        actorRole: actorUser?.role || "ADMIN",
        clientId,
        action: "ASSIGN_USER",
        entityType: "client_user",
        entityId: `${clientId}_${userId}`,
        after: created,
      });

      return created;
    });
  }

  async updateClient(
    user: AuthenticatedUser,
    id: string,
    data: Prisma.ClientUpdateInput,
  ) {
    this.checkClientAccess(user, id);

    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException("Client not found");

    return this.prisma.client.update({
      where: { id },
      data,
    });
  }

  async deleteClient(id: string, actorUser?: AuthenticatedUser) {
    if (actorUser && actorUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Requires SUPER_ADMIN role");
    }

    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException("Client not found");

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({
        where: { id },
        data: { isActive: false },
      });
      await this.auditLogsService.recordLog(tx, {
        actorUserId: actorUser?.id || "system",
        actorRole: actorUser?.role || "SUPER_ADMIN",
        clientId: id,
        action: "DELETE",
        entityType: "client",
        entityId: id,
        before: client,
        after: updated,
      });
      return updated;
    });
  }

  async createEmbedToken(user: AuthenticatedUser, dto: CreateEmbedTokenDto) {
    const clientId = dto.clientId || user.clientIds?.[0];
    if (!clientId) {
      throw new ForbiddenException("User is not assigned to any client");
    }

    this.checkClientAccess(user, clientId);

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException("Client not found");

    const rawKey = crypto.randomBytes(32).toString("hex");
    const token = `emb_${rawKey}`;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const tokenPrefix = `emb_${rawKey.slice(0, 8)}...`;

    // Until we decide who may grant the scope, accept it only from ADMIN and SUPER_ADMIN
    const scopes =
      (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) && dto.scopes
        ? dto.scopes
        : [];

    const created = await this.prisma.$transaction(async (tx) => {
      const embedToken = await tx.clientEmbedToken.create({
        data: {
          clientId,
          name: dto.name,
          tokenHash,
          tokenPrefix,
          allowedOrigins: dto.allowedOrigins,
          scopes,
          isActive: true,
        },
      });

      await this.auditLogsService.recordLog(tx, {
        actorUserId: user.id,
        actorRole: user.role,
        clientId,
        action: "CREATE_EMBED_TOKEN",
        entityType: "client_embed_token",
        entityId: embedToken.id,
        after: { id: embedToken.id, name: embedToken.name, clientId, scopes },
      });

      return embedToken;
    });

    return {
      id: created.id,
      clientId: created.clientId,
      name: created.name,
      token, // Return ONCE
      tokenPrefix: created.tokenPrefix,
      allowedOrigins: created.allowedOrigins,
      scopes: created.scopes,
      isActive: created.isActive,
      createdAt: created.createdAt,
    };
  }

  async listEmbedTokens(user: AuthenticatedUser, clientId: string) {
    this.checkClientAccess(user, clientId);

    return this.prisma.clientEmbedToken.findMany({
      where: { clientId },
      select: {
        id: true,
        clientId: true,
        name: true,
        tokenPrefix: true,
        allowedOrigins: true,
        scopes: true,
        isActive: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeEmbedToken(user: AuthenticatedUser, id: string) {
    const token = await this.prisma.clientEmbedToken.findUnique({
      where: { id },
    });
    if (!token) throw new NotFoundException("Embed token not found");

    this.checkClientAccess(user, token.clientId);

    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.clientEmbedToken.update({
        where: { id },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });

      await this.auditLogsService.recordLog(tx, {
        actorUserId: user.id,
        actorRole: user.role,
        clientId: token.clientId,
        action: "REVOKE_EMBED_TOKEN",
        entityType: "client_embed_token",
        entityId: id,
        before: token,
        after: revoked,
      });

      return {
        id: revoked.id,
        message: "Embed token revoked successfully",
        isActive: false,
        revokedAt: revoked.revokedAt,
      };
    });
  }
}
