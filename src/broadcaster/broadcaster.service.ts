import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBroadcasterDto } from "./dto/create-broadcaster.dto";
import { UpdateBroadcasterDto } from "./dto/update-broadcaster.dto";
import * as bcrypt from "bcrypt";
import { Prisma, Role, UserStatus } from "@prisma/client";
import { BroadcasterFilterDto } from "./dto/broadcaster-filter.dto";
import { buildPrismaPagination } from "../common/utils/pagination.util";
import {
  PageMetaDto,
  PaginatedResponseDto,
} from "../common/dto/paginated-response.dto";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { EmailService } from "../notifications/email.service";

@Injectable()
export class BroadcasterService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
    private emailService: EmailService,
  ) {}

  async create(
    createBroadcasterDto: CreateBroadcasterDto,
    actorUser?: AuthenticatedUser,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createBroadcasterDto.email },
      include: { clientUsers: true },
    });

    // Determine target clientId
    const targetClientId =
      createBroadcasterDto.clientId ||
      (actorUser?.role === Role.ADMIN ? actorUser.clientIds?.[0] : undefined);

    if (existingUser) {
      if (existingUser.role !== Role.BROADCASTER) {
        throw new ConflictException("User with this email already exists");
      }

      // If user is already a broadcaster and a target client was specified, link to that client if not already linked
      if (targetClientId) {
        const alreadyLinked = existingUser.clientUsers.some(
          (cu) => cu.clientId === targetClientId,
        );
        if (!alreadyLinked) {
          await this.prisma.clientUser.create({
            data: {
              clientId: targetClientId,
              userId: existingUser.id,
            },
          });
        }
      }

      const updatedUser = await this.prisma.user.findUnique({
        where: { id: existingUser.id },
        omit: { password: true },
        include: { profile: true },
      });

      return {
        ...updatedUser,
        emailSent: false,
      };
    }

    const plainTextPassword =
      createBroadcasterDto.password ||
      Math.random().toString(36).slice(-10) + "Aa1!";
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    const {
      email,
      name,
      status,
      firstName,
      lastName,
      dobDay,
      dobMonth,
      dobYear,
      phone,
      country,
      state,
      homeAddress,
      photos,
      photo,
      bio,
    } = createBroadcasterDto;

    const resolvedName =
      name || (firstName && lastName ? `${firstName} ${lastName}` : undefined);
    const photosArray = photo ? [photo, ...(photos || [])] : photos || [];

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: resolvedName,
          role: Role.BROADCASTER,
          status: status || UserStatus.ACTIVE,
          forcePasswordChange: true,
        },
      });

      await tx.userProfile.create({
        data: {
          userId: user.id,
          fullName: resolvedName,
          dobDay,
          dobMonth,
          dobYear,
          phone,
          email,
          country,
          state,
          homeAddress,
          photos: photosArray,
          bio,
        },
      });

      if (targetClientId) {
        await tx.clientUser.create({
          data: {
            clientId: targetClientId,
            userId: user.id,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        omit: { password: true },
        include: { profile: true },
      });
    });

    const emailSent = await this.emailService.sendWelcomeEmail(
      email,
      plainTextPassword,
      Role.BROADCASTER,
    );

    return {
      ...createdUser,
      emailSent: Boolean(emailSent),
    };
  }

  async findAll(filterDto: BroadcasterFilterDto, user?: AuthenticatedUser) {
    const { status, page = 1, limit = 10 } = filterDto || {};

    const where: Prisma.UserWhereInput = { role: Role.BROADCASTER };

    if (user && user.role === Role.ADMIN) {
      where.clientUsers = {
        some: {
          clientId: { in: user.clientIds || [] },
        },
      };
    }

    if (status) {
      where.status = status;
    } else {
      where.status = UserStatus.ACTIVE;
    }

    const { skip, take, orderBy, searchWhere } = buildPrismaPagination(
      filterDto,
      {
        defaultOrderBy: { createdAt: "desc" },
        searchFields: ["name", "email"],
      },
    );

    Object.assign(where, searchWhere);

    const [items, itemCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        omit: { password: true },
        include: { profile: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return new PaginatedResponseDto(
      items,
      new PageMetaDto({ page, limit, itemCount }),
    );
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const broadcaster = await this.prisma.user.findFirst({
      where: { id, role: Role.BROADCASTER },
      omit: { password: true },
      include: {
        profile: true,
        clientUsers: true,
      },
    });

    if (!broadcaster) {
      throw new NotFoundException("Broadcaster not found");
    }

    if (user && user.role === Role.ADMIN) {
      const belongsToClient = broadcaster.clientUsers.some((cu) =>
        user.clientIds?.includes(cu.clientId),
      );
      if (!belongsToClient) {
        throw new NotFoundException("Broadcaster not found");
      }
    }

    const matchBroadcasters = await this.prisma.matchBroadcaster.findMany({
      where: { userId: id },
      include: {
        match: {
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            scheduledDate: true,
            venue: true,
            status: true,
            tournamentId: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
    });

    const assignedMatches = matchBroadcasters.map((mb) => ({
      matchId: mb.match.id,
      homeTeam: mb.match.homeTeam as Record<string, unknown> | null,
      awayTeam: mb.match.awayTeam as Record<string, unknown> | null,
      scheduledDate: mb.match.scheduledDate,
      venue: mb.match.venue,
      status: mb.match.status,
      tournamentId: mb.match.tournamentId,
      homeScore: mb.match.homeScore,
      awayScore: mb.match.awayScore,
    }));

    const { clientUsers: _cu, ...broadcasterData } = broadcaster;

    return {
      ...broadcasterData,
      assignedMatches,
    };
  }

  async update(
    id: string,
    updateBroadcasterDto: UpdateBroadcasterDto,
    user?: AuthenticatedUser,
  ) {
    await this.findOne(id, user);

    const {
      email,
      password,
      name,
      status,
      firstName,
      lastName,
      dobDay,
      dobMonth,
      dobYear,
      phone,
      country,
      state,
      homeAddress,
      photos,
      photo,
      bio,
    } = updateBroadcasterDto;

    const userData: Prisma.UserUpdateInput = {};
    if (email !== undefined) userData.email = email;
    if (name !== undefined) userData.name = name;
    if (status !== undefined) userData.status = status;
    if (password) {
      userData.password = await bcrypt.hash(password, 10);
      userData.forcePasswordChange = true;
    }

    const profileData: Prisma.UserProfileUpdateWithoutUserInput = {};
    if (firstName !== undefined || lastName !== undefined) {
      const existingProfile = await this.prisma.userProfile.findUnique({
        where: { userId: id },
      });
      const newFirstName =
        firstName !== undefined
          ? firstName
          : existingProfile?.fullName?.split(" ")[0] || "";
      const newLastName =
        lastName !== undefined
          ? lastName
          : existingProfile?.fullName?.split(" ").slice(1).join(" ") || "";
      const newFullName = `${newFirstName || ""} ${newLastName || ""}`.trim();
      profileData.fullName = newFullName;
      if (name === undefined) {
        userData.name = newFullName;
      }
    }
    if (dobDay !== undefined) profileData.dobDay = dobDay;
    if (dobMonth !== undefined) profileData.dobMonth = dobMonth;
    if (dobYear !== undefined) profileData.dobYear = dobYear;
    if (phone !== undefined) profileData.phone = phone;
    if (country !== undefined) profileData.country = country;
    if (state !== undefined) profileData.state = state;
    if (homeAddress !== undefined) profileData.homeAddress = homeAddress;
    if (bio !== undefined) profileData.bio = bio;

    if (photo || photos) {
      const existing = await this.prisma.userProfile.findUnique({
        where: { userId: id },
        select: { photos: true },
      });
      const base = photos ?? existing?.photos ?? [];
      profileData.photos = photo
        ? [photo, ...base.filter((p) => p !== photo)]
        : base;
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...userData,
        profile: {
          update: profileData,
        },
      },
      omit: { password: true },
      include: { profile: true },
    });
  }

  async updatePhoto(id: string, photoUrl: string, user?: AuthenticatedUser) {
    await this.findOne(id, user);

    const existing = await this.prisma.userProfile.findUnique({
      where: { userId: id },
      select: { photos: true },
    });
    const currentPhotos = existing?.photos ?? [];
    const updatedPhotos = [
      photoUrl,
      ...currentPhotos.filter((p) => p !== photoUrl),
    ];

    return this.prisma.user.update({
      where: { id },
      data: {
        profile: {
          update: { photos: updatedPhotos },
        },
      },
      omit: { password: true },
      include: { profile: true },
    });
  }

  async remove(id: string, actorUser?: AuthenticatedUser) {
    const existing = await this.prisma.user.findFirst({
      where: { id, role: Role.BROADCASTER },
    });
    if (!existing) throw new NotFoundException("Broadcaster not found");

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
        omit: { password: true },
      });

      await this.auditLogsService.recordLog(tx, {
        actorUserId: actorUser?.id || "system",
        actorRole: actorUser?.role || "ADMIN",
        action: "DELETE",
        entityType: "broadcaster",
        entityId: id,
        before: existing,
        after: updated,
      });

      return updated;
    });
  }
}
