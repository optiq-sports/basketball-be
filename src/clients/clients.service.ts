import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import * as crypto from 'crypto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { AuthenticatedUser } from 'src/common/interfaces/user.interface';
import { EmailService } from '../notifications/email.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) { }

  private checkClientAccess(user: AuthenticatedUser, clientId: string) {
    if (user.role !== 'SUPER_ADMIN') {
      if (!user.clientIds?.includes(clientId)) {
        throw new ForbiddenException('Not authorized for this client');
      }
    }
  }

  async createApiKey(user: AuthenticatedUser, createApiKeyDto: CreateApiKeyDto) {
    const { clientId, name } = createApiKeyDto;

    this.checkClientAccess(user, clientId);

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Generate a secure random string for the API key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKey = `optiq_${rawKey}`;

    // Hash the key for storage
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const createdKey = await this.prisma.clientApiKey.create({
      data: {
        clientId,
        name,
        keyHash,
      },
    });

    return {
      id: createdKey.id,
      name: createdKey.name,
      clientId: createdKey.clientId,
      apiKey, // Return this ONCE
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
        createdAt: true,
        lastUsed: true,
      },
    });
  }

  async revokeApiKey(user: AuthenticatedUser, id: string) {
    const apiKey = await this.prisma.clientApiKey.findUnique({ where: { id } });
    if (!apiKey) throw new NotFoundException('API Key not found');

    this.checkClientAccess(user, apiKey.clientId);

    return this.prisma.clientApiKey.delete({
      where: { id },
    });
  }

  async createClient(createClientDto: CreateClientDto) {
    const { userEmail, userFirstName, userLastName, ...clientData } = createClientDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Auto-generate password
    const plainTextPassword = Math.random().toString(36).slice(-10) + 'Aa1!';
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    return this.prisma.$transaction(async (prisma) => {
      // 1. Create the Client Organization
      const client = await prisma.client.create({
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
            }
          }
        },
      });

      // 3. Link them via ClientUser
      await prisma.clientUser.create({
        data: {
          clientId: client.id,
          userId: user.id,
        },
      });

      // Fire off welcome email in background
      this.emailService.sendWelcomeEmail(userEmail, plainTextPassword, Role.CLIENT);

      return client;
    });
  }

  async listClients(paginationQuery: PaginationQueryDto) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    const [data, itemCount] = await Promise.all([
      this.prisma.client.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.count(),
    ]);

    const { PageMetaDto, PaginatedResponseDto } = await import('../common/dto/paginated-response.dto');
    return new PaginatedResponseDto(data, new PageMetaDto({ page, limit, itemCount }));
  }

  async assignUserToClient(clientId: string, dto: AssignUserDto) {
    const { userId } = dto;

    // Ensure client exists
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Ensure user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already assigned
    const existing = await this.prisma.clientUser.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId,
        },
      },
    });

    if (existing) {
      return existing; // Or throw conflict
    }

    return this.prisma.clientUser.create({
      data: {
        clientId,
        userId,
      },
    });
  }
}
