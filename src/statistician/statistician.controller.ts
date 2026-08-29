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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { StatisticianResponseDto } from "./dto/statistician-response.dto";

@ApiTags("Statisticians")
@ApiBearerAuth()
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
  @ApiOperation({ summary: "Create a new statistician" })
  @ApiBody({ type: CreateStatisticianDto })
  @ApiResponse({ status: 201, description: "Statistician successfully created", type: StatisticianResponseDto })
  @AppErrorResponse(400, "Bad Request", "POST", "/api/statistician", "Invalid input data")
  @AppErrorResponse(401, "Unauthorized", "POST", "/api/statistician", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "POST", "/api/statistician", "Requires SUPER_ADMIN or ADMIN role")
  @AppErrorResponse(409, "Conflict", "POST", "/api/statistician", "User with this email already exists")
  create(@Body() createStatisticianDto: CreateStatisticianDto) {
    return this.statisticianService.create(createStatisticianDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Get all statisticians" })
  @ApiResponse({ status: 200, description: "Returns a list of statisticians", type: [StatisticianResponseDto] })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/statistician", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "GET", "/api/statistician", "Requires SUPER_ADMIN or ADMIN role")
  findAll() {
    return this.statisticianService.findAll();
  }

  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Get a specific statistician by ID" })
  @ApiResponse({ status: 200, description: "Returns the specific statistician", type: StatisticianResponseDto })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/statistician/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "GET", "/api/statistician/:id", "Requires SUPER_ADMIN or ADMIN role")
  @AppErrorResponse(404, "Not Found", "GET", "/api/statistician/:id", "Statistician not found")
  findOne(@Param("id") id: string) {
    return this.statisticianService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Update a specific statistician" })
  @ApiBody({ type: UpdateStatisticianDto })
  @ApiResponse({ status: 200, description: "Statistician successfully updated", type: StatisticianResponseDto })
  @AppErrorResponse(400, "Bad Request", "PATCH", "/api/statistician/:id", "Invalid input data")
  @AppErrorResponse(401, "Unauthorized", "PATCH", "/api/statistician/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PATCH", "/api/statistician/:id", "Requires SUPER_ADMIN or ADMIN role")
  @AppErrorResponse(404, "Not Found", "PATCH", "/api/statistician/:id", "Statistician not found")
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
  @ApiOperation({ summary: "Upload a photo for a statistician" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        photo: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Photo successfully uploaded", type: StatisticianResponseDto })
  @AppErrorResponse(400, "Bad Request", "PATCH", "/api/statistician/:id/photo", "No file uploaded")
  @AppErrorResponse(401, "Unauthorized", "PATCH", "/api/statistician/:id/photo", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "PATCH", "/api/statistician/:id/photo", "Requires SUPER_ADMIN or ADMIN role")
  @AppErrorResponse(404, "Not Found", "PATCH", "/api/statistician/:id/photo", "Statistician not found")
  @AppErrorResponse(500, "Internal Server Error", "PATCH", "/api/statistician/:id/photo", "Internal server error")
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
  @ApiOperation({ summary: "Deactivate a statistician" })
  @ApiResponse({ status: 200, description: "Statistician successfully deactivated" })
  @AppErrorResponse(401, "Unauthorized", "DELETE", "/api/statistician/:id", "Invalid or missing access token")
  @AppErrorResponse(403, "Forbidden", "DELETE", "/api/statistician/:id", "Requires SUPER_ADMIN or ADMIN role")
  @AppErrorResponse(404, "Not Found", "DELETE", "/api/statistician/:id", "Statistician not found")
  remove(@Param("id") id: string) {
    return this.statisticianService.remove(id);
  }
}
