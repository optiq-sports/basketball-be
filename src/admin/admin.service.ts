import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";
import * as bcrypt from "bcrypt";
import { Role, UserStatus } from "@prisma/client";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async create(currentUser: any, createAdminDto: CreateAdminDto) {
    if (currentUser.role === Role.ADMIN) {
      if (
        createAdminDto.role === Role.SUPER_ADMIN ||
        createAdminDto.role === Role.ADMIN
      ) {
        throw new ForbiddenException(
          "Admins cannot create other Admins or Super Admins",
        );
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: createAdminDto.email },
    });
    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }
    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);
    return this.prisma.user.create({
      data: {
        ...createAdminDto,
        password: hashedPassword,
        role: createAdminDto.role || Role.ADMIN, // Default to ADMIN
        status: createAdminDto.status || UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException("Admin not found");
    return user;
  }

  async update(currentUser: any, id: string, updateAdminDto: UpdateAdminDto) {
    if (currentUser.role === Role.ADMIN) {
      if (
        updateAdminDto.role === Role.SUPER_ADMIN ||
        updateAdminDto.role === Role.ADMIN
      ) {
        throw new ForbiddenException(
          "Admins cannot update other Admins or Super Admins",
        );
      }
    }

    const data: any = { ...updateAdminDto };
    if (updateAdminDto.password) {
      data.password = await bcrypt.hash(updateAdminDto.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });
  }
}
