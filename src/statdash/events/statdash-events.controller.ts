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

@Controller("statdash/events")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STATISTICIAN)
export class StatdashEventsController {
  constructor(private readonly statdashEventsService: StatdashEventsService) {}

  @Post("command")
  command(@Body() dto: StatdashCommandDto, @Req() request: Request & { user?: { id?: string } }) {
    return this.statdashEventsService.handleCommand(dto, request.user?.id ?? "unknown_actor");
  }

  @Patch(":eventId/correct")
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
