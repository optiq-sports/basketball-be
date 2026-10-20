import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from "@nestjs/common";
import { MatchesService } from "./matches.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";
import { MatchResponseDto } from "./dto/match-response.dto";
import { AssignBroadcastersDto } from "./dto/assign-broadcasters.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role, MatchStatus } from "@prisma/client";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { ApiPaginatedResponse } from "../common/decorators/api-paginated-response.decorator";
import { MatchFilterDto } from "./dto/match-filter.dto";

@ApiTags("Matches")
@ApiBearerAuth()
@Controller("matches")
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Create a new match" })
  @ApiBody({ type: CreateMatchDto })
  @ApiResponse({
    status: 201,
    description: "Match successfully created",
    type: MatchResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/matches",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/matches",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/api/matches",
    "Requires ADMIN or STATISTICIAN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/matches",
    "Tournament or Teams not found",
  )
  create(@Body() createMatchDto: CreateMatchDto, @CurrentUser() user: any) {
    return this.matchesService.create(createMatchDto, user);
  }

  @Get()
  @ApiOperation({ summary: "Get all matches" })
  @ApiPaginatedResponse(MatchResponseDto)
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/matches",
    "Invalid or missing access token",
  )
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filterDto: MatchFilterDto,
  ) {
    const statisticianId =
      user.role === Role.STATISTICIAN ? user.id : undefined;
    return this.matchesService.findAll(user, filterDto, statisticianId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific match by ID" })
  @ApiResponse({
    status: 200,
    description: "Returns the specific match",
    type: MatchResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/matches/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/matches/:id",
    "Match not found",
  )
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.matchesService.findOne(id, user);
  }

  @Put(":id/broadcasters")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Assign broadcasters to a match" })
  @ApiBody({ type: AssignBroadcastersDto })
  @ApiResponse({
    status: 200,
    description: "Broadcasters successfully assigned to match",
    type: MatchResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PUT",
    "/api/matches/:id/broadcasters",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "PUT",
    "/api/matches/:id/broadcasters",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "PUT",
    "/api/matches/:id/broadcasters",
    "Requires SUPER_ADMIN or ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PUT",
    "/api/matches/:id/broadcasters",
    "Match not found",
  )
  assignBroadcasters(
    @Param("id") id: string,
    @Body() assignBroadcastersDto: AssignBroadcastersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchesService.assignBroadcasters(
      id,
      assignBroadcastersDto.broadcasterIds,
      user,
    );
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  @ApiOperation({ summary: "Update a specific match" })
  @ApiBody({ type: UpdateMatchDto })
  @ApiResponse({
    status: 200,
    description: "Match successfully updated",
    type: MatchResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PATCH",
    "/api/matches/:id",
    "Invalid input data",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "PATCH",
    "/api/matches/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "PATCH",
    "/api/matches/:id",
    "Requires ADMIN or STATISTICIAN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PATCH",
    "/api/matches/:id",
    "Match not found",
  )
  update(
    @Param("id") id: string,
    @Body() updateMatchDto: UpdateMatchDto,
    @CurrentUser() user: any,
  ) {
    return this.matchesService.update(id, updateMatchDto, user);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Delete a match" })
  @ApiResponse({ status: 200, description: "Match successfully deleted" })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "DELETE",
    "/api/matches/:id",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "DELETE",
    "/api/matches/:id",
    "Requires ADMIN role",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "DELETE",
    "/api/matches/:id",
    "Match not found",
  )
  remove(@Param("id") id: string, @CurrentUser() user: any) {
    return this.matchesService.remove(id, user);
  }
}
