import * as fs from 'fs';

const path = 'src/tournaments/tournaments.controller.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'import { TournamentResponseDto } from "./dto/tournament-response.dto";',
  'import { TournamentResponseDto } from "./dto/tournament-response.dto";\nimport { CurrentUser } from "../auth/decorators/current-user.decorator";\nimport { AuthenticatedUser } from "../common/interfaces/user.interface";\nimport { PaginationQueryDto } from "../common/dto/pagination-query.dto";\nimport { Query } from "@nestjs/common";\nimport { PaginatedResponseDto } from "../common/dto/paginated-response.dto";'
);

code = code.replace(
  'create(@Body() createTournamentDto: CreateTournamentDto) {\n    return this.tournamentsService.create(createTournamentDto);\n  }',
  'create(@Body() createTournamentDto: CreateTournamentDto, @CurrentUser() user: AuthenticatedUser) {\n    return this.tournamentsService.create(createTournamentDto, user);\n  }'
);

code = code.replace(
  'findAll() {\n    return this.tournamentsService.findAll();\n  }',
  'findAll(@CurrentUser() user: AuthenticatedUser, @Query() paginationDto?: PaginationQueryDto) {\n    return this.tournamentsService.findAll(user, paginationDto);\n  }'
);

code = code.replace(
  'findByCode(@Param("code") code: string) {\n    return this.tournamentsService.findByCode(code);\n  }',
  'findByCode(@Param("code") code: string) {\n    return this.tournamentsService.findByCode(code);\n  }'
);

code = code.replace(
  'findOne(@Param("id") id: string) {\n    return this.tournamentsService.findOne(id);\n  }',
  'findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {\n    return this.tournamentsService.findOne(id, user);\n  }'
);

code = code.replace(
  'update(\n    @Param("id") id: string,\n    @Body() updateTournamentDto: UpdateTournamentDto,\n  ) {\n    return this.tournamentsService.update(id, updateTournamentDto);\n  }',
  'update(\n    @Param("id") id: string,\n    @Body() updateTournamentDto: UpdateTournamentDto,\n    @CurrentUser() user: AuthenticatedUser,\n  ) {\n    return this.tournamentsService.update(id, updateTournamentDto, user);\n  }'
);

code = code.replace(
  'addTeams(\n    @Param("id") id: string,\n    @Body() addTeamDto: AddTeamToTournamentDto,\n  ) {\n    return this.tournamentsService.addTeams(id, addTeamDto);\n  }',
  'addTeams(\n    @Param("id") id: string,\n    @Body() addTeamDto: AddTeamToTournamentDto,\n    @CurrentUser() user: AuthenticatedUser,\n  ) {\n    return this.tournamentsService.addTeams(id, addTeamDto, user);\n  }'
);

code = code.replace(
  'removeTeam(@Param("id") id: string, @Param("teamId") teamId: string) {\n    return this.tournamentsService.removeTeam(id, teamId);\n  }',
  'removeTeam(@Param("id") id: string, @Param("teamId") teamId: string, @CurrentUser() user: AuthenticatedUser) {\n    return this.tournamentsService.removeTeam(id, teamId, user);\n  }'
);

code = code.replace(
  'updateFlyer(\n    @Param("id") id: string,\n    @UploadedFile() file: Express.Multer.File,\n  ) {\n    if (!file) {\n      throw new BadRequestException("No image file provided");\n    }\n    const flyerUrl = "TODO: Implement actual file upload to cloud storage";\n    return this.tournamentsService.updateFlyer(id, flyerUrl);\n  }',
  'updateFlyer(\n    @Param("id") id: string,\n    @UploadedFile() file: Express.Multer.File,\n    @CurrentUser() user: AuthenticatedUser,\n  ) {\n    if (!file) {\n      throw new BadRequestException("No image file provided");\n    }\n    const flyerUrl = "TODO: Implement actual file upload to cloud storage";\n    return this.tournamentsService.updateFlyer(id, flyerUrl, user);\n  }'
);

code = code.replace(
  'remove(@Param("id") id: string) {\n    return this.tournamentsService.remove(id);\n  }',
  'remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {\n    return this.tournamentsService.remove(id, user);\n  }'
);

code = code.replace(
  'getStandings(@Param("id") id: string) {\n    return this.tournamentsService.getStandings(id);\n  }',
  'getStandings(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {\n    return this.tournamentsService.getStandings(id, user);\n  }'
);

code = code.replace(
  'getMatchSchedule(@Param("id") id: string) {\n    return this.tournamentsService.getMatchSchedule(id);\n  }',
  'getMatchSchedule(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {\n    return this.tournamentsService.getMatchSchedule(id, user);\n  }'
);

code = code.replace(
  'getTopScorers(@Param("id") id: string) {\n    return this.tournamentsService.getTopScorers(id);\n  }',
  'getTopScorers(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {\n    return this.tournamentsService.getTopScorers(id, user);\n  }'
);

fs.writeFileSync(path, code);
