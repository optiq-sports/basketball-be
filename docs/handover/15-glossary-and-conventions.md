# 15 — Glossary and Conventions

[← Known Issues](./14-known-issues-and-roadmap.md) | [Index](./README.md) | [Next: Checklist →](./16-handover-checklist.md)

## Domain glossary

### Basketball terms

| Term | Meaning in this platform |
|------|--------------------------|
| Tournament | A competition instance with division, schedule rules, enrolled teams |
| Division | Tier: PREMIER, DIVISION_1–3, JUNIOR |
| Match / Game | Single game between home and away team within a tournament |
| Quarter | Period of play; duration from `Tournament.quarterDuration` |
| Overtime | Extra period; `Tournament.overtimeDuration` |
| Box score | Per-player stat totals (points, rebounds, assists, etc.) |
| Shot chart | Spatial record of shot attempts with coordinates |
| Possession | Which team has the ball (`GameSession.possessionTeamId`) |
| Jump ball | Opening possession determination |
| Free throw | Foul shot sequence (1, 2, or 3 depending on foul type) |
| Offensive rebound | Rebound by shooting team — may lead to follow-up shot |
| Dead ball | Stoppage (out of bounds, violation, etc.) |

### App-specific terms

| Term | Meaning |
|------|---------|
| StatDash | Event-sourced live statistics subsystem (`src/statdash/`) |
| GameSession | Live stat capture session, 1:1 with Match |
| GameEvent | Append-only stat event in session log |
| Command | Client intent (e.g. `shot`) sent to `/statdash/events/command` |
| Projection | Read model derived from events (box score, shot chart) |
| Idempotency key | Client-generated key preventing duplicate event application |
| expectedVersion | Optimistic concurrency token matching `GameSession.version` |
| PlayerTeam | Junction: player roster membership on a team with jersey |
| MatchPlayer | Player roster for a specific match (team attribution) |
| MatchStat | Aggregated stats row per match/player/team |
| Deduplication | Fuzzy matching to prevent duplicate player profiles |
| DLQ | Dead-letter queue for failed BullMQ jobs |

## Code conventions

### Naming

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `statdash-events.service.ts` |
| Classes | PascalCase | `StatdashEventsService` |
| Modules | `*.module.ts` | `PlayersModule` |
| Controllers | `*.controller.ts` | `PlayersController` |
| Services | `*.service.ts` | `PlayersService` |
| DTOs | `*.dto.ts` | `CreatePlayerDto` |
| Specs | `*.spec.ts` | `players.service.spec.ts` |
| DB tables | snake_case via `@map` | `player_team` |
| Prisma fields | camelCase in TS, mapped to snake_case | `firstName` → `first_name` |

### Folder structure per domain

```
src/<domain>/
├── <domain>.module.ts
├── <domain>.controller.ts
├── <domain>.service.ts
└── dto/
    ├── create-*.dto.ts
    └── update-*.dto.ts
```

StatDash adds subfolders: `sessions/`, `events/`, `projections/`, `realtime/`, `contracts/`, `events/rules/`.

### DTO patterns

- Use `class-validator` decorators (`@IsString()`, `@IsEmail()`, etc.)
- Use `@nestjs/mapped-types` `PartialType` for update DTOs where applicable
- Global `ValidationPipe` strips non-whitelisted properties
- Prisma enums imported from `@prisma/client` in DTOs

### Response patterns

- Success: wrapped by `TransformInterceptor` unless `@SkipResponseTransform()`
- Errors: thrown as `HttpException` subclasses; filter formats consistently
- StatDash errors: include custom `code` field in exception response object

### Auth patterns

```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard)
export class ResourceController {
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STATISTICIAN)
  create() {}
}
```

Class-level JWT; method-level roles when restrictions apply.

## Git branching strategy

`[UNKNOWN — needs owner input]` — No `CONTRIBUTING.md` or branch policy in repo.

Suggested default:
- `main` — production-ready
- `feature/*` — feature branches
- PR required with tests passing

## PR / review expectations

`[UNKNOWN — needs owner input]`

Recommended:
- Unit tests for new service logic
- StatDash changes require rules spec updates
- No secrets in commits
- Run `npm run lint` before merge

## Recipe: Add a new NestJS module / endpoint

1. **Generate module** (or create manually):
   ```bash
   nest g module my-feature
   nest g controller my-feature
   nest g service my-feature
   ```

2. **Create DTOs** in `src/my-feature/dto/` with class-validator decorators

3. **Implement service** using `PrismaService` — follow logging pattern:
   ```typescript
   private readonly logger = new Logger(MyFeatureService.name);
   ```

4. **Wire controller**:
   - `@Controller('my-feature')`
   - `@UseGuards(JwtAuthGuard)` at class level
   - `@UseGuards(RolesGuard)` + `@Roles(...)` on restricted methods

5. **Register module** in `src/app.module.ts` imports array

6. **Prisma changes** (if needed):
   ```bash
   npx prisma migrate dev --name describe_change
   ```

7. **Add tests**: `my-feature.service.spec.ts`

8. **Update Postman** collection in `postman/`

9. **Document endpoint** in handover `04-api-reference.md` (or project GUIDE)

## Recipe: Add a StatDash command type

1. Add type to `src/statdash/contracts/event-types.ts`
2. Create payload DTO in `src/statdash/events/dto/`
3. Register in `validate-command-payload.ts`
4. Add rule handler in `src/statdash/events/rules/` if non-trivial
5. Register in `statdash-rule-engine.ts`
6. Add unit tests in `statdash-rules.spec.ts`
7. Add e2e scenario if part of verification matrix

## Cross-references

- Architecture: [02-architecture-overview.md](./02-architecture-overview.md)
- API patterns: [04-api-reference.md](./04-api-reference.md)
