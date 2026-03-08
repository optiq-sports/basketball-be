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
        include: { profile: true },
      });
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      where: { role: Role.STATISTICIAN },
      include: { profile: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException("Statistician not found");
    return user;
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
    if (email) userData.email = email;
    if (name) userData.name = name;
    if (status) userData.status = status;
    if (password) {
      userData.password = await bcrypt.hash(password, 10);
    }

    const profileData: any = {};
    if (firstName || lastName)
      profileData.fullName = `${firstName || ""} ${lastName || ""}`.trim();
    if (dobDay) profileData.dobDay = dobDay;
    if (dobMonth) profileData.dobMonth = dobMonth;
    if (dobYear) profileData.dobYear = dobYear;
    if (phone) profileData.phone = phone;
    if (country) profileData.country = country;
    if (state) profileData.state = state;
    if (homeAddress) profileData.homeAddress = homeAddress;
    if (bio) profileData.bio = bio;

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
      include: { profile: true },
    });
  }

  async updatePhoto(id: string, photoUrl: string) {
    // Ensure user exists
    await this.findOne(id);
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
      include: { profile: true },
    });
  }

  remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });
  }
}
