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
  Query,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { BroadcasterService } from "./broadcaster.service";
import { CreateBroadcasterDto } from "./dto/create-broadcaster.dto";
import { UpdateBroadcasterDto } from "./dto/update-broadcaster.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import type { IUploadProvider } from "../upload/interfaces/upload-provider.interface";
import { UPLOAD_PROVIDER } from "../upload/upload.constants";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { ApiPaginatedResponse } from "../common/decorators/api-paginated-response.decorator";
import { BroadcasterFilterDto } from "./dto/broadcaster-filter.dto";
import { BroadcasterResponseDto } from "./dto/broadcaster-response.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/interfaces/user.interface";

@ApiTags("Broadcasters")
@ApiBearerAuth()
@Controller("broadcaster")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class BroadcasterController {
  constructor(
    private readonly broadcasterService: BroadcasterService,
    @Inject(UPLOAD_PROVIDER) private readonly uploadProvider: IUploadProvider,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new broadcaster" })
  @ApiBody({ type: CreateBroadcasterDto })
  @ApiResponse({
    status: 201,
    description: "Broadcaster successfully created",
    type: BroadcasterResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/broadcaster",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/broadcaster",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/api/broadcaster",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/broadcaster",
    "User with this email already exists",
  )
  create(
    @Body() createBroadcasterDto: CreateBroadcasterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.broadcasterService.create(createBroadcasterDto, user);
  }

  @Get()
  @ApiOperation({ summary: "Get all broadcasters" })
  @ApiPaginatedResponse(BroadcasterResponseDto)
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/broadcaster",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/api/broadcaster",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  findAll(
    @Query() filterDto: BroadcasterFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.broadcasterService.findAll(filterDto, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific broadcaster by ID" })
  @ApiResponse({
    status: 200,
    description: "Returns the specific broadcaster",
    type: BroadcasterResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/broadcaster/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/api/broadcaster/:id",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcaster/:id",
    "Broadcaster not found",
  )
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.broadcasterService.findOne(id, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a specific broadcaster" })
  @ApiBody({ type: UpdateBroadcasterDto })
  @ApiResponse({
    status: 200,
    description: "Broadcaster successfully updated",
    type: BroadcasterResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PATCH",
    "/api/broadcaster/:id",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "PATCH",
    "/api/broadcaster/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "PATCH",
    "/api/broadcaster/:id",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PATCH",
    "/api/broadcaster/:id",
    "Broadcaster not found",
  )
  update(
    @Param("id") id: string,
    @Body() updateBroadcasterDto: UpdateBroadcasterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.broadcasterService.update(id, updateBroadcasterDto, user);
  }

  @Patch(":id/photo")
  @UseInterceptors(FileInterceptor("photo"))
  @ApiOperation({ summary: "Upload a photo for a broadcaster" })
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
  @ApiResponse({
    status: 200,
    description: "Photo successfully uploaded",
    type: BroadcasterResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PATCH",
    "/api/broadcaster/:id/photo",
    "No file uploaded",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "PATCH",
    "/api/broadcaster/:id/photo",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "PATCH",
    "/api/broadcaster/:id/photo",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PATCH",
    "/api/broadcaster/:id/photo",
    "Broadcaster not found",
  )
  async uploadPhoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException(
        "No file uploaded. Use form-data key: photo",
      );
    }
    const { url } = await this.uploadProvider.uploadFile(file);
    return this.broadcasterService.updatePhoto(id, url, user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Deactivate a broadcaster" })
  @ApiResponse({
    status: 200,
    description: "Broadcaster successfully deactivated",
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/api/broadcaster/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/api/broadcaster/:id",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/api/broadcaster/:id",
    "Broadcaster not found",
  )
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.broadcasterService.remove(id, user);
  }
}
