import { Controller, Param, Query, Sse, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Observable } from "rxjs";
import { MessageEvent } from "@nestjs/common";
import { Roles } from "../../auth/decorators/roles.decorator";
import { SkipResponseTransform } from "../../common/decorators/skip-response-transform.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { StatdashRealtimeService } from "./statdash-realtime.service";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AppErrorResponse } from "../../common/decorators/api-errors.decorator";
import { StreamQueryDto } from "./dto/stream-query.dto";

@ApiTags("Statdash Realtime")
@ApiBearerAuth()
@Controller("statdash/realtime")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.STATISTICIAN)
export class StatdashRealtimeController {
  constructor(private readonly statdashRealtimeService: StatdashRealtimeService) {}

  @Sse("sessions/:sessionId/stream")
  @SkipResponseTransform()
  @ApiOperation({ summary: "Connect to Server-Sent Events (SSE) stream for a session" })
  @ApiResponse({ status: 200, description: "SSE Stream successfully connected (produces text/event-stream)" })
  @AppErrorResponse(401, "Unauthorized", "GET", "/api/statdash/realtime/sessions/:sessionId/stream", "Invalid or missing access token")
  stream(
    @Param("sessionId") sessionId: string,
    @Query() query: StreamQueryDto,
  ): Observable<MessageEvent> {
    const sinceVersion = query.sinceVersion;
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
