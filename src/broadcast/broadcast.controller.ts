import { Controller, Get, Param, Headers, Req } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { BroadcastService } from "./broadcast.service";
import { BroadcastClientDto } from "./dto/broadcast-client.dto";
import { BroadcastMatchesResponseDto } from "./dto/broadcast-matches-response.dto";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import type { AppRequest } from "../common/interfaces/app.interface";

@ApiTags("Broadcast Clients")
@Controller("broadcast")
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get("matches")
  @ApiOperation({
    summary: "Get broadcast client matches resolved from Host subdomain",
  })
  @ApiHeader({
    name: "host",
    description: "Subdomain host header (e.g. onesporttv.optiqsports.com)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client games retrieved successfully",
    type: BroadcastMatchesResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "GET",
    "/api/broadcast/matches",
    "Broadcast client slug could not be determined",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/matches",
    "Broadcast client not found",
  )
  getMatchesByHost(
    @Headers("host") host: string | undefined,
    @Req() req: AppRequest,
  ): Promise<BroadcastMatchesResponseDto> {
    const slug = this.broadcastService.resolveSlug(undefined, host);
    return this.broadcastService.getBroadcastMatches(slug, req.user);
  }

  @Get(":slug/matches")
  @ApiOperation({
    summary: "Get games assigned to a broadcast client by slug",
  })
  @ApiParam({
    name: "slug",
    description: "Broadcast client slug (e.g. onesporttv)",
    example: "onesporttv",
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client games retrieved successfully",
    type: BroadcastMatchesResponseDto,
  })
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/:slug/matches",
    "Broadcast client not found",
  )
  getMatchesBySlug(
    @Param("slug") slugParam: string,
    @Headers("host") host: string | undefined,
    @Req() req: AppRequest,
  ): Promise<BroadcastMatchesResponseDto> {
    const slug = this.broadcastService.resolveSlug(slugParam, host);
    return this.broadcastService.getBroadcastMatches(slug, req.user);
  }

  @Get(":slug")
  @ApiOperation({
    summary: "Get broadcast client profile by slug",
  })
  @ApiParam({
    name: "slug",
    description: "Broadcast client slug (e.g. onesporttv)",
    example: "onesporttv",
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client details retrieved successfully",
    type: BroadcastClientDto,
  })
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast/:slug",
    "Broadcast client not found",
  )
  getClientBySlug(
    @Param("slug") slugParam: string,
    @Headers("host") host: string | undefined,
  ): Promise<BroadcastClientDto> {
    const slug = this.broadcastService.resolveSlug(slugParam, host);
    return this.broadcastService.getBroadcastClientBySlug(slug);
  }

  @Get()
  @ApiOperation({
    summary: "Get broadcast client profile resolved from Host subdomain",
  })
  @ApiHeader({
    name: "host",
    description: "Subdomain host header (e.g. onesporttv.optiqsports.com)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast client details retrieved successfully",
    type: BroadcastClientDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "GET",
    "/api/broadcast",
    "Broadcast client slug could not be determined",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/broadcast",
    "Broadcast client not found",
  )
  getClientByHost(
    @Headers("host") host: string | undefined,
  ): Promise<BroadcastClientDto> {
    const slug = this.broadcastService.resolveSlug(undefined, host);
    return this.broadcastService.getBroadcastClientBySlug(slug);
  }
}
