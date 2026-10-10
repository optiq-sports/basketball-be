import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStatisticianDto } from "./dto/create-statistician.dto";
import { UpdateStatisticianDto } from "./dto/update-statistician.dto";
import * as bcrypt from "bcrypt";
import { Role, UserStatus } from "@prisma/client";
import { StatisticianFilterDto } from "./dto/statistician-filter.dto";
import { buildPrismaPagination } from "../common/utils/pagination.util";
import {
  PageMetaDto,
  PaginatedResponseDto,
} from "../common/dto/paginated-response.dto";

@Injectable()
export class StatisticianService {
  constructor(private prisma: PrismaService) {}

  async create(createStatisticianDto: CreateStatisticianDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createStatisticianDto.email },
    });
    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const password = createStatisticianDto.password || "123456789";
    const hashedPassword = await bcrypt.hash(password, 10);

    // Profile data extraction
    const {
      email,
      password: _p,
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
    } = createStatisticianDto;

    // Build photos array: if single photo URL provided, prepend it
    const photosArray = photo ? [photo, ...(photos || [])] : photos || [];

    return this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name:
            name ||
            (firstName && lastName ? `${firstName} ${lastName}` : undefined),
          role: Role.STATISTICIAN,
          status: status || UserStatus.ACTIVE,
          forcePasswordChange: true,
        },
      });

      await prisma.userProfile.create({
        data: {
          userId: user.id,
          fullName:
            name ||
            (firstName && lastName ? `${firstName} ${lastName}` : undefined),
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

      return prisma.user.findUnique({
        where: { id: user.id },
        omit: { password: true },
        include: { profile: true },
      });
    });
  }

  async findAll(filterDto: StatisticianFilterDto) {
    const {
      status,
      page = 1,
      limit = 10,
      sortBy,
      sortOrder,
      search,
    } = filterDto || {};

    const where: any = { role: Role.STATISTICIAN };

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

  async findOne(id: string, user: any) {
    const statistician = await this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
      include: {
        profile: true,
      },
    });
    if (!statistician) throw new NotFoundException("Statistician not found");

    const { getTenantFilter } = await import("../common/filters/tenant.filter");
    const tenantFilter = getTenantFilter(user);

    const matches = await this.prisma.match.findMany({
      where: {
        statisticianId: id,
        tournament: tenantFilter,
      },
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
    });

    const gamesOfficiated = matches.map((match) => ({
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      scheduledDate: match.scheduledDate,
      venue: match.venue,
      status: match.status,
      tournamentId: match.tournamentId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    }));

    return {
      ...statistician,
      gamesOfficiated,
    };
  }

  async update(id: string, updateStatisticianDto: UpdateStatisticianDto) {
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
    } = updateStatisticianDto;

    const userData: any = {};
    if (email !== undefined) userData.email = email;
    if (name !== undefined) userData.name = name;
    if (status !== undefined) userData.status = status;
    if (password) {
      userData.password = await bcrypt.hash(password, 10);
      userData.forcePasswordChange = true;
    }

    const profileData: any = {};
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

    // Handle photo updates: single URL prepended to the array
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

  async updatePhoto(id: string, photoUrl: string) {
    // Ensure user exists
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Statistician not found");
    // Prepend the new photo URL, replacing any existing first photo if same URL
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

  remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
      omit: { password: true },
    });
  }
}
