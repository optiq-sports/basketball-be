import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Sse,
  Query,
  ForbiddenException,
} from "@nestjs/common";
import { ClientApiService } from "./client-api.service";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import {
  ClientMatchDto,
  ClientShotChartEventDto,
  ClientTeamDto,
  ClientTeamDetailDto,
  ClientTournamentDto,
  ClientTournamentDetailDto,
  ClientStandingDto,
  ClientLeaderDto,
  ClientLeadersQueryDto,
} from "./dto/client-api.dto";
import { BoxScoreResponseDto } from "../statdash/projections/dto/statdash-projection-responses.dto";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { from, Observable } from "rxjs";
import { switchMap } from "rxjs/operators";
import { MessageEvent } from "@nestjs/common";
import type { AppRequest } from "../common/interfaces/app.interface";

@ApiTags("External Client API v1")
@ApiSecurity("x-api-key")
@UseGuards(ApiKeyGuard)
@Controller("v1/client")
export class ClientApiController {
  constructor(private readonly clientApiService: ClientApiService) {}

  private getAuthorizedClientId(
    req: AppRequest,
    queryClientId?: string,
  ): string {
    const userClientIds = req.user?.clientIds || [];

    if (queryClientId) {
      if (
        req.user?.role !== "SUPER_ADMIN" &&
        !userClientIds.includes(queryClientId)
      ) {
        throw new ForbiddenException(
          `Access denied for client ${queryClientId}`,
        );
      }
      return queryClientId;
    }

    return userClientIds[0];
  }

  // ---------------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------------

  @Get("teams")
  @ApiOperation({ summary: "List all teams for the client" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: [ClientTeamDto] })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/teams",
    "Invalid or missing API key",
  )
  getTeams(@Req() req: AppRequest, @Query("clientId") clientId?: string) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getTeams(authorizedClientId);
  }

  @Get("teams/:teamId")
  @ApiOperation({ summary: "Get details and roster for a specific team" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: ClientTeamDetailDto })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/teams/:teamId",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/teams/:teamId",
    "Team not found",
  )
  getTeamDetails(
    @Req() req: AppRequest,
    @Param("teamId") teamId: string,
    @Query("clientId") clientId?: string,
  ) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getTeamDetails(authorizedClientId, teamId);
  }

  // ---------------------------------------------------------------------------
  // Tournaments
  // ---------------------------------------------------------------------------

  @Get("tournaments")
  @ApiOperation({ summary: "List all tournaments for the client" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: [ClientTournamentDto] })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/tournaments",
    "Invalid or missing API key",
  )
  getTournaments(@Req() req: AppRequest, @Query("clientId") clientId?: string) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getTournaments(authorizedClientId);
  }

  @Get("tournaments/:tournamentId")
  @ApiOperation({ summary: "Get details for a specific tournament" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: ClientTournamentDetailDto })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/tournaments/:tournamentId",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/tournaments/:tournamentId",
    "Tournament not found",
  )
  getTournamentDetails(
    @Req() req: AppRequest,
    @Param("tournamentId") tournamentId: string,
    @Query("clientId") clientId?: string,
  ) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getTournamentDetails(
      authorizedClientId,
      tournamentId,
    );
  }

  @Get("tournaments/:tournamentId/standings")
  @ApiOperation({ summary: "Get standings/table for a specific tournament" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: [ClientStandingDto] })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/tournaments/:tournamentId/standings",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/tournaments/:tournamentId/standings",
    "Tournament not found",
  )
  getTournamentStandings(
    @Req() req: AppRequest,
    @Param("tournamentId") tournamentId: string,
    @Query("clientId") clientId?: string,
  ) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getTournamentStandings(
      authorizedClientId,
      tournamentId,
    );
  }

  @Get("tournaments/:tournamentId/leaders")
  @ApiOperation({ summary: "Get league leaders for a specific tournament" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: [ClientLeaderDto] })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/tournaments/:tournamentId/leaders",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/tournaments/:tournamentId/leaders",
    "Tournament not found",
  )
  getTournamentLeaders(
    @Req() req: AppRequest,
    @Param("tournamentId") tournamentId: string,
    @Query() query: ClientLeadersQueryDto,
    @Query("clientId") clientId?: string,
  ) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getTournamentLeaders(
      authorizedClientId,
      tournamentId,
      query.category,
      query.limit,
    );
  }

  // ---------------------------------------------------------------------------
  // Matches
  // ---------------------------------------------------------------------------

  @Get("matches")
  @ApiOperation({ summary: "List all matches for the client" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: [ClientMatchDto] })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/matches",
    "Invalid or missing API key",
  )
  getMatches(@Req() req: AppRequest, @Query("clientId") clientId?: string) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getMatches(authorizedClientId);
  }

  @Get("matches/:matchId")
  @ApiOperation({ summary: "Get details of a specific match" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: ClientMatchDto })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/matches/:matchId",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/matches/:matchId",
    "Match not found",
  )
  getMatchDetails(
    @Req() req: AppRequest,
    @Param("matchId") matchId: string,
    @Query("clientId") clientId?: string,
  ) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getMatchDetails(authorizedClientId, matchId);
  }

  @Get("matches/:matchId/box-score")
  @ApiOperation({ summary: "Get the box score for a specific match session" })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: BoxScoreResponseDto })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/matches/:matchId/box-score",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/matches/:matchId/box-score",
    "Match session not found",
  )
  getBoxScore(
    @Req() req: AppRequest,
    @Param("matchId") matchId: string,
    @Query("clientId") clientId?: string,
  ) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getBoxScore(authorizedClientId, matchId);
  }

  @Get("matches/:matchId/shot-chart")
  @ApiOperation({
    summary: "Get basic shot chart events (without precise coordinates)",
  })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({ status: 200, type: [ClientShotChartEventDto] })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/matches/:matchId/shot-chart",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/matches/:matchId/shot-chart",
    "Match session not found",
  )
  getShotChart(
    @Req() req: AppRequest,
    @Param("matchId") matchId: string,
    @Query("clientId") clientId?: string,
  ) {
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);
    return this.clientApiService.getShotChart(
      authorizedClientId,
      matchId,
      req.user?.scopes,
    );
  }

  @Sse("matches/:matchId/stream")
  @ApiOperation({
    summary: "Connect to Server-Sent Events (SSE) stream for a match",
  })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Optional client ID. Defaults to assigned client.",
  })
  @ApiResponse({
    status: 200,
    description:
      "SSE Stream successfully connected (produces text/event-stream)",
  })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/v1/client/matches/:matchId/stream",
    "Invalid or missing API key",
  )
  @AppErrorResponse(
    404,
    "Not Found",
    "GET",
    "/api/v1/client/matches/:matchId/stream",
    "Match session not found",
  )
  streamMatch(
    @Req() req: AppRequest,
    @Param("matchId") matchId: string,
    @Query()
    query: import("../statdash/realtime/dto/stream-query.dto").StreamQueryDto,
    @Query("clientId") clientId?: string,
  ): Observable<MessageEvent> {
    const sinceVersion = query.sinceVersion;
    const parsedSinceVersion =
      typeof sinceVersion === "string" && sinceVersion.length > 0
        ? Number(sinceVersion)
        : undefined;
    const authorizedClientId = this.getAuthorizedClientId(req, clientId);

    // Wrap the Promise in an Observable and flatten it using switchMap
    const streamPromise = this.clientApiService.streamMatch(
      authorizedClientId,
      matchId,
      Number.isFinite(parsedSinceVersion) ? parsedSinceVersion : undefined,
      req.user?.scopes,
    );

    return from(streamPromise).pipe(switchMap((stream) => stream));
  }
}
