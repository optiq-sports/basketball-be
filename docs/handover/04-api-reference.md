# 04 — API Reference

[← Getting Started](./03-getting-started.md) | [Index](./README.md) | [Next: Data Model →](./05-data-model.md)

## Base URL, versioning, prefix

| Setting | Value | Source |
|---------|-------|--------|
| Global prefix | `/api` | `src/main.ts` |
| Versioning | None (no `/v1`) | — |
| Default port | `3000` | `process.env.PORT \|\| 3000` |
| Local base URL | `http://localhost:3000/api` | — |

## Authentication flow

### Register

- `POST /api/auth/register` — **No auth required**
- Body: `RegisterDto` — `email`, `password`, optional `role` (defaults `STATISTICIAN`)
- Returns: `access_token`, `refresh_token`, `user`
- Creates `Session` row in DB

### Login

- `POST /api/auth/login` — **No auth** (uses `LocalAuthGuard` after body parse)
- Body: `email`, `password`
- Returns tokens + user; persists session

### Profile

- `GET /api/auth/profile` — **JWT required**
- Returns `req.user` from JWT strategy (id, email, name, role, profile)

### JWT usage

```
Authorization: Bearer <access_token>
```

For SSE (EventSource cannot set headers), pass query param:

```
GET /api/statdash/realtime/sessions/:sessionId/stream?access_token=<token>
```

See `src/auth/strategies/jwt.strategy.ts` — `jwtFromBearerOrQuery`.

### Refresh tokens

Refresh tokens are **issued** on login/register (`refresh_token` in response, stored in `Session.refreshToken`) but there is **no** `POST /auth/refresh` endpoint. Clients must re-login.

### Roles

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Bypasses all `@Roles` checks; exclusive `/api/admin` |
| `ADMIN` | Full CRUD except super-admin routes; can delete |
| `STATISTICIAN` | Create/update most entities; no deletes on core resources |

`SUPER_ADMIN` override: `src/auth/guards/roles.guard.ts` lines 21–24.

## Standard response format

### Success (most endpoints)

Wrapped by `TransformInterceptor`:

```json
{
  "success": true,
  "data": { },
  "timestamp": "2026-07-01T12:00:00.000Z"
}
```

Skip transform with `@SkipResponseTransform()` decorator (used on SSE).

### Error

From `HttpExceptionFilter`:

```json
{
  "statusCode": 400,
  "timestamp": "2026-07-01T12:00:00.000Z",
  "path": "/api/...",
  "method": "POST",
  "message": "Error description",
  "code": "P2002",
  "details": { }
}
```

StatDash-specific error codes (in thrown exceptions): `SD_VERSION_CONFLICT`, `SD_IDEMPOTENCY_KEY_REUSED_DIFFERENT_REQUEST`, `SD_SESSION_LOCK_BUSY`.

## Endpoint inventory

Unless noted, routes require **JWT**. Role columns list additional `RolesGuard` requirements.

### Auth — `src/auth/auth.controller.ts`

| Method | Path | Auth | Roles | Body / params | Response / notes |
|--------|------|------|-------|---------------|------------------|
| POST | `/auth/register` | No | — | `email`, `password`, `role?` | Tokens + user |
| POST | `/auth/login` | No | — | `email`, `password` | Tokens + user |
| GET | `/auth/profile` | JWT | — | — | Current user |

### Players — `src/players/players.controller.ts`

| Method | Path | Roles | Body / query | Notes |
|--------|------|-------|--------------|-------|
| POST | `/players` | ADMIN, STATISTICIAN | `CreatePlayerDto` | Deduplication; `confirmDuplicate` for fuzzy matches |
| POST | `/players/team` | ADMIN, STATISTICIAN | `CreatePlayerForTeamDto` | Creates + assigns jersey |
| POST | `/players/team/bulk` | ADMIN, STATISTICIAN | `BulkCreatePlayersForTeamDto` | Bulk import |
| POST | `/players/team/:teamId/upload` | ADMIN, STATISTICIAN | multipart `file` | Excel/CSV via xlsx |
| GET | `/players` | — | `?teamId=`, `?unassigned=true` | List |
| GET | `/players/:id` | — | — | Detail |
| PATCH | `/players/:id` | ADMIN, STATISTICIAN | `UpdatePlayerDto` | |
| PUT | `/players/:id/teams/:teamId` | ADMIN, STATISTICIAN | `{ jerseyNumber }` | Assign to team |
| DELETE | `/players/:id/teams/:teamId` | ADMIN, STATISTICIAN | — | Soft-remove from team |
| DELETE | `/players/:id` | ADMIN | — | Deactivates team associations |
| POST | `/players/merge` | ADMIN | `duplicatePlayerId`, `targetPlayerId` | Merge profiles |

### Teams — `src/teams/teams.controller.ts`

| Method | Path | Roles | Body / query | Notes |
|--------|------|-------|--------------|-------|
| POST | `/teams` | ADMIN, STATISTICIAN | `CreateTeamDto` | Unique `code` |
| GET | `/teams` | — | `?tournamentId=` | Filter by tournament |
| GET | `/teams/:id` | — | — | Includes players |
| PATCH | `/teams/:id` | ADMIN, STATISTICIAN | `UpdateTeamDto` | |
| PATCH | `/teams/:id/players/:playerId/captain` | ADMIN, STATISTICIAN | `{ isCaptain }` | Unsets prior captain |
| DELETE | `/teams/:id` | ADMIN | — | |

### Tournaments — `src/tournaments/tournaments.controller.ts`

| Method | Path | Roles | Body / params | Notes |
|--------|------|-------|---------------|-------|
| POST | `/tournaments` | ADMIN, STATISTICIAN | `CreateTournamentDto` | Auto-generates `code` |
| GET | `/tournaments` | — | — | List |
| GET | `/tournaments/code/:code` | — | — | Lookup by code |
| GET | `/tournaments/:id` | — | — | Detail + teams |
| PATCH | `/tournaments/:id` | ADMIN, STATISTICIAN | `UpdateTournamentDto` | |
| PATCH | `/tournaments/:id/flyer` | ADMIN, STATISTICIAN | multipart `flyer` | Cloudinary upload |
| POST | `/tournaments/:id/teams` | ADMIN, STATISTICIAN | `{ teamIds: [] }` | |
| DELETE | `/tournaments/:id/teams/:teamId` | ADMIN | — | |
| DELETE | `/tournaments/:id` | ADMIN | — | |

### Matches — `src/matches/matches.controller.ts`

| Method | Path | Roles | Body / query | Notes |
|--------|------|-------|--------------|-------|
| POST | `/matches` | ADMIN, STATISTICIAN | `CreateMatchDto` | Teams must be in tournament |
| GET | `/matches` | — | `?tournamentId=`, `?status=` | |
| GET | `/matches/:id` | — | — | With stats |
| PATCH | `/matches/:id` | ADMIN, STATISTICIAN | `UpdateMatchDto` | Manual scores/status |
| DELETE | `/matches/:id` | ADMIN | — | |

### Admin — `src/admin/admin.controller.ts`

All routes: JWT + **SUPER_ADMIN only**.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/admin` | `CreateAdminDto` | Creates ADMIN user |
| GET | `/admin` | — | List admins |
| GET | `/admin/:id` | — | |
| PATCH | `/admin/:id` | `UpdateAdminDto` | |
| DELETE | `/admin/:id` | — | |

### Statistician — `src/statistician/statistician.controller.ts`

| Method | Path | Roles | Body | Notes |
|--------|------|-------|------|-------|
| POST | `/statistician` | SUPER_ADMIN, ADMIN | `CreateStatisticianDto` | |
| GET | `/statistician` | SUPER_ADMIN, ADMIN | — | |
| GET | `/statistician/:id` | SUPER_ADMIN, ADMIN | — | |
| PATCH | `/statistician/:id` | SUPER_ADMIN, ADMIN | `UpdateStatisticianDto` | |
| PATCH | `/statistician/:id/photo` | SUPER_ADMIN, ADMIN | multipart `photo` | |
| DELETE | `/statistician/:id` | SUPER_ADMIN, ADMIN | — | |

### Upload — `src/upload/upload.controller.ts`

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/upload` | **None** | multipart `file` | `{ url, publicId }` |

### Ops / Queues — `src/common/queue/queue.controller.ts`

Prefix: `/api/ops/queues`. Roles: **ADMIN, SUPER_ADMIN**.

| Method | Path | Query | Purpose |
|--------|------|-------|---------|
| GET | `/ops/queues/health` | — | Queue job counts |
| GET | `/ops/queues/lag` | — | Waiting job lag |
| POST | `/ops/queues/dead-letter/requeue` | `?limit=25` | Requeue DLQ jobs |
| POST | `/ops/queues/warm/session` | `?sessionId=` | Warm projection caches |

### StatDash Sessions — `src/statdash/sessions/statdash-sessions.controller.ts`

Roles: SUPER_ADMIN, ADMIN, STATISTICIAN.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/statdash/sessions/resolve-match-key` | `ResolveMatchKeyDto` | Resolve match by ID or tournament code |
| POST | `/statdash/sessions/bootstrap` | `BootstrapSessionDto` | Create/load session snapshot |
| POST | `/statdash/sessions/:sessionId/start` | — | PENDING → IN_PROGRESS |
| GET | `/statdash/sessions/:sessionId/state` | — | Full state snapshot |

### StatDash Events — `src/statdash/events/statdash-events.controller.ts`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/statdash/events/command` | `StatdashCommandDto` | Ingest gameplay command |
| PATCH | `/statdash/events/:eventId/correct` | `CorrectEventDto` | Amend event payload |
| POST | `/statdash/events/:eventId/reverse` | `ReverseEventDto` | Reverse event |

### StatDash Projections — `src/statdash/projections/statdash-projections.controller.ts`

Roles: ADMIN, STATISTICIAN (SUPER_ADMIN passes via guard override).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/statdash/projections/match/:sessionId/box-score` | Player stat totals |
| GET | `/statdash/projections/match/:sessionId/shot-chart` | Shot coordinates |
| GET | `/statdash/projections/player/:playerId/game/:sessionId` | Single-player slice |
| GET | `/statdash/projections/match/:sessionId/summary` | Match summary |
| POST | `/statdash/projections/match/:sessionId/rebuild` | Force rebuild + MatchStat sync |

### StatDash Realtime — `src/statdash/realtime/statdash-realtime.controller.ts`

| Method | Path | Query | Purpose |
|--------|------|-------|---------|
| SSE GET | `/statdash/realtime/sessions/:sessionId/stream` | `?sinceVersion=N` | Live updates |

SSE event type: `statdash-update`. See [07-statdash-realtime.md](./07-statdash-realtime.md).

## Postman collection

**Path:** `postman/Basketball_Management_API.postman_collection.json`

Import into Postman for sample requests. `GUIDE.md` mirrors frontend integration patterns. Postman may not include all StatDash endpoints — verify against controllers above.

## WebSocket / realtime summary

| Mechanism | Used? | Endpoint |
|-----------|-------|----------|
| WebSocket | No | — |
| SSE | Yes | `/api/statdash/realtime/sessions/:sessionId/stream` |
| Polling | Client-side only | `/api/statdash/sessions/:sessionId/state` |

## Cross-references

- Domain workflows: [06-core-domains.md](./06-core-domains.md)
- StatDash commands: [07-statdash-realtime.md](./07-statdash-realtime.md)
- Data models: [05-data-model.md](./05-data-model.md)
