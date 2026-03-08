import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { StatisticianService } from "./statistician.service";
import { CreateStatisticianDto } from "./dto/create-statistician.dto";
import { UpdateStatisticianDto } from "./dto/update-statistician.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import { IUploadProvider } from "../upload/interfaces/upload-provider.interface";
import { UPLOAD_PROVIDER } from "../upload/upload.constants";

@Controller("statistician")
@UseGuards(JwtAuthGuard)
export class StatisticianController {
  constructor(
    private readonly statisticianService: StatisticianService,
    @Inject(UPLOAD_PROVIDER) private readonly uploadProvider: IUploadProvider,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() createStatisticianDto: CreateStatisticianDto) {
    return this.statisticianService.create(createStatisticianDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll() {
    return this.statisticianService.findAll();
  }

  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param("id") id: string) {
    return this.statisticianService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param("id") id: string,
    @Body() updateStatisticianDto: UpdateStatisticianDto,
  ) {
    return this.statisticianService.update(id, updateStatisticianDto);
  }

  @Patch(":id/photo")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(FileInterceptor("photo"))
  async uploadPhoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        "No file uploaded. Use form-data key: photo",
      );
    }
    const { url } = await this.uploadProvider.uploadFile(file);
    return this.statisticianService.updatePhoto(id, url);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.statisticianService.remove(id);
  }
}
