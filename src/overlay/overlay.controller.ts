import { Controller, Get, Param, Sse } from "@nestjs/common";
import { MessageEvent } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { OverlayService } from "./overlay.service";
import { OverlaySceneResponseDto } from "./dto/overlay-scene.dto";
import { Observable, from } from "rxjs";
import { switchMap } from "rxjs/operators";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { SkipResponseTransform } from "../common/decorators/skip-response-transform.decorator";

@ApiTags("Overlay Output (Public OBS / vMix)")
@Controller("overlay")
export class OverlayController {
  constructor(private readonly overlayService: OverlayService) {}

  @Get(":token")
  @ApiOperation({
    summary: "Get current overlay scene state for OBS/vMix browser source",
    description:
      "Fetches the active graphic scene, master visibility, scorebug visibility, auto-dismiss timestamp, and opaque payload.",
  })
  @ApiParam({
    name: "token",
    description: "Overlay URL token",
    example: "ovl_abc123xyz",
  })
  @ApiResponse({
    status: 200,
    description: "Returns current overlay scene state",
    type: OverlaySceneResponseDto,
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/overlay/:token",
    "Overlay token has expired or been revoked",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/overlay/:token",
    "Client is inactive",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/overlay/:token",
    "Overlay token not found",
  )
  async getScene(
    @Param("token") token: string,
  ): Promise<OverlaySceneResponseDto> {
    return this.overlayService.getSceneByToken(token);
  }

  @Sse(":token/stream")
  @SkipResponseTransform()
  @ApiOperation({
    summary: "Subscribe to real-time overlay scene updates via SSE",
    description:
      "Server-Sent Events stream emitting 'overlay' events upon state change and ': ping' heartbeat frames every 15s.",
  })
  @ApiParam({
    name: "token",
    description: "Overlay URL token",
    example: "ovl_abc123xyz",
  })
  @ApiResponse({
    status: 200,
    description: "SSE stream successfully established (text/event-stream)",
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/overlay/:token/stream",
    "Overlay token has expired or been revoked",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "GET",
    "/overlay/:token/stream",
    "Client is inactive",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/overlay/:token/stream",
    "Overlay token not found",
  )
  streamOverlay(@Param("token") token: string): Observable<MessageEvent> {
    const streamPromise = this.overlayService.getStream(token);
    return from(streamPromise).pipe(switchMap((stream) => stream));
  }
}
