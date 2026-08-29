import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { BootstrapSessionDto } from "./dto/bootstrap-session.dto";
import { ResolveMatchKeyDto } from "./dto/resolve-match-key.dto";
import { StatdashSessionsService } from "./statdash-sessions.service";

@Controller("statdash/sessions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.STATISTICIAN)
export class StatdashSessionsController {
  constructor(private readonly statdashSessionsService: StatdashSessionsService) {}

  @Post("resolve-match-key")
  resolveMatchKey(@Body() dto: ResolveMatchKeyDto) {
    return this.statdashSessionsService.resolveMatchKey(dto.matchKey);
  }

  @Post("bootstrap")
  bootstrap(@Body() dto: BootstrapSessionDto) {
    return this.statdashSessionsService.bootstrap(dto);
  }

  @Post(":sessionId/start")
  startSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.startSession(sessionId);
  }

  @Get(":sessionId/state")
  getState(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.getState(sessionId);
  }
  
  @Post(":sessionId/pause")
  pauseSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.pauseSession(sessionId);
  }

  @Post(":sessionId/complete")
  completeSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.completeSession(sessionId);
  }

  @Post(":sessionId/cancel")
  cancelSession(@Param("sessionId") sessionId: string) {
    return this.statdashSessionsService.cancelSession(sessionId);
  }
}
