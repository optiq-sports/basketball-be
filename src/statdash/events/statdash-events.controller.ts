import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Request } from "express";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { StatdashCommandDto } from "./dto/statdash-command.dto";
import { CorrectEventDto } from "./dto/correct-event.dto";
import { ReverseEventDto } from "./dto/reverse-event.dto";
import { StatdashEventsService } from "./statdash-events.service";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppErrorResponse } from "../../common/decorators/api-errors.decorator";
import {
  CommandResultDto,
  CorrectionOrReversalResultDto,
} from "./dto/statdash-event-responses.dto";

@ApiTags("Statdash Events")
@ApiBearerAuth()
@Controller("statdash/events")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.STATISTICIAN)
export class StatdashEventsController {
  constructor(private readonly statdashEventsService: StatdashEventsService) {}

  @Post("command")
  @ApiOperation({ summary: "Submit a new game event command" })
  @ApiBody({ type: StatdashCommandDto })
  @ApiResponse({
    status: 201,
    description: "Command successfully processed",
    type: CommandResultDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/statdash/events/command",
    "Invalid payload or rule violation",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/events/command",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/events/command",
    "Session does not exist",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/statdash/events/command",
    "Session lock busy or version conflict",
  )
  command(
    @Body() dto: StatdashCommandDto,
    @Req() request: Request & { user?: { id?: string } },
  ) {
    return this.statdashEventsService.handleCommand(
      dto,
      request.user?.id ?? "unknown_actor",
    );
  }

  @Patch(":eventId/correct")
  @ApiOperation({ summary: "Correct an existing game event" })
  @ApiBody({ type: CorrectEventDto })
  @ApiResponse({
    status: 200,
    description: "Event successfully corrected",
    type: CorrectionOrReversalResultDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "PATCH",
    "/api/statdash/events/:eventId/correct",
    "Cannot correct correction/reversal events",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "PATCH",
    "/api/statdash/events/:eventId/correct",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "PATCH",
    "/api/statdash/events/:eventId/correct",
    "Target event does not exist",
  )
  correctEvent(
    @Param("eventId") eventId: string,
    @Body() dto: CorrectEventDto,
    @Req() request: Request & { user?: { id?: string } },
  ) {
    return this.statdashEventsService.correctEvent(
      eventId,
      dto,
      request.user?.id ?? "unknown_actor",
    );
  }

  @Post(":eventId/reverse")
  @ApiOperation({ summary: "Reverse an existing game event" })
  @ApiBody({ type: ReverseEventDto })
  @ApiResponse({
    status: 201,
    description: "Event successfully reversed",
    type: CorrectionOrReversalResultDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/statdash/events/:eventId/reverse",
    "Invalid or missing access token",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "POST",
    "/api/statdash/events/:eventId/reverse",
    "Target event does not exist",
  )
  reverseEvent(
    @Param("eventId") eventId: string,
    @Body() dto: ReverseEventDto,
    @Req() request: Request & { user?: { id?: string } },
  ) {
    return this.statdashEventsService.reverseEvent(
      eventId,
      dto,
      request.user?.id ?? "unknown_actor",
    );
  }
}
