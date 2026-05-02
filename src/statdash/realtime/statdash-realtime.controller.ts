import { Controller, Param, Query, Sse, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Observable } from "rxjs";
import { MessageEvent } from "@nestjs/common";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { StatdashRealtimeService } from "./statdash-realtime.service";

@Controller("statdash/realtime")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.STATISTICIAN)
export class StatdashRealtimeController {
  constructor(private readonly statdashRealtimeService: StatdashRealtimeService) {}

  @Sse("sessions/:sessionId/stream")
  stream(
    @Param("sessionId") sessionId: string,
    @Query("sinceVersion") sinceVersion?: string,
  ): Observable<MessageEvent> {
    const parsedSinceVersion =
      typeof sinceVersion === "string" && sinceVersion.length > 0
        ? Number(sinceVersion)
        : undefined;
    return this.statdashRealtimeService.streamBySession(
      sessionId,
      Number.isFinite(parsedSinceVersion) ? parsedSinceVersion : undefined,
    );
  }
}
