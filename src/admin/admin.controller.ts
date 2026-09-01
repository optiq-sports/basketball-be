import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";
import { AdminResponseDto } from "./dto/admin-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";

@ApiTags("Admins")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @ApiOperation({ summary: "Create a new admin" })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({
    status: 201,
    description: "Admin successfully created",
    type: AdminResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/admin",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/admin",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/api/admin",
    "Requires SUPER_ADMIN role, or trying to create forbidden role",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/admin",
    "User with this email already exists",
  )
  create(@Request() req, @Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(req.user, createAdminDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all admins" })
  @ApiResponse({
    status: 200,
    description: "Returns a list of admins",
    type: [AdminResponseDto],
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/admin",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/api/admin",
    "Requires SUPER_ADMIN role",
  )
  findAll() {
    return this.adminService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific admin by ID" })
  @ApiResponse({
    status: 200,
    description: "Returns the specific admin",
    type: AdminResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/admin/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/api/admin/:id",
    "Requires SUPER_ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/admin/:id",
    "Admin not found",
  )
  findOne(@Param("id") id: string) {
    return this.adminService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a specific admin" })
  @ApiBody({ type: UpdateAdminDto })
  @ApiResponse({
    status: 200,
    description: "Admin successfully updated",
    type: AdminResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PATCH",
    "/api/admin/:id",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "PATCH",
    "/api/admin/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "PATCH",
    "/api/admin/:id",
    "Requires SUPER_ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PATCH",
    "/api/admin/:id",
    "Admin not found",
  )
  update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    return this.adminService.update(req.user, id, updateAdminDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Deactivate an admin" })
  @ApiResponse({ status: 200, description: "Admin successfully deactivated" })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/api/admin/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/api/admin/:id",
    "Requires SUPER_ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/api/admin/:id",
    "Admin not found",
  )
  remove(@Param("id") id: string) {
    return this.adminService.remove(id);
  }
}
