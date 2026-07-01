# 01 — Executive Summary

[← Index](./README.md) | [Next: Architecture →](./02-architecture-overview.md)

## What this project does

**basketball-be** is a NestJS (TypeScript) REST API for managing basketball tournaments, teams, players, and matches, with a production-oriented **StatDash** subsystem for live in-game statistics capture. Statisticians record shots, fouls, rebounds, and related events via commands; the backend persists an append-only event log, projects box scores and shot charts, and streams updates to clients over Server-Sent Events (SSE). The API serves admin dashboards, statistician tooling, and frontend consumers under the global prefix `/api`.

**Author / license:** Optiq Sport, ISC (`package.json`).

## Business purpose and users

| User type | Role(s) | Primary activities |
|-----------|---------|-------------------|
| Platform super admin | `SUPER_ADMIN` | Manage admin accounts (`/api/admin`) |
| Tournament admin | `ADMIN` | CRUD entities, delete resources, manage statisticians |
| Statistician | `STATISTICIAN` | Enter live game stats via StatDash, manage rosters/matches |
| Frontend apps | JWT consumer | Read tournaments/matches, subscribe to SSE, display standings |
| Ops | `ADMIN` / `SUPER_ADMIN` | Queue health at `/api/ops/queues/*` |

See [09-security-and-auth.md](./09-security-and-auth.md) for full RBAC matrix.

## Current maturity

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| Core CRUD | Implemented | Players, Teams, Tournaments, Matches modules |
| Live stats (StatDash) | Implemented, tested | `src/statdash/`, e2e verification doc |
| Production readiness | **Likely staging / active dev** | No CI/CD in repo; docker-compose commented out |
| Observability | Basic | NestJS `Logger`, no APM wired |
| API docs | Postman + `GUIDE.md` | No Swagger/OpenAPI |

`[UNKNOWN — needs owner input]` — Confirm whether a production deployment exists and its URL.

## Tech stack summary

| Layer | Technology | Version (package.json) |
|-------|------------|------------------------|
| Runtime | Node.js (Bun mentioned in README, not required) | Node 18+ implied |
| Framework | NestJS | ^10.4.0 |
| Language | TypeScript | ^5.9.3 |
| ORM | Prisma | ^6.17.1 |
| Database | PostgreSQL | via `DATABASE_URL` |
| Cache / pub-sub | Redis (ioredis) | ^5.10.1 — optional (`REDIS_URL`) |
| Job queue | BullMQ | ^5.76.2 — optional (`REDIS_URL`) |
| Auth | Passport JWT + Local | passport-jwt ^4.0.1 |
| Password hashing | bcrypt | ^6.0.0 |
| File storage | Cloudinary | ^2.9.0 |
| Logging | NestJS Logger (+ unused Winston in `src/logger/logger.ts`) | winston ^3.19.0 |
| Testing | Jest + Supertest | jest ^29.7.0 |

## Key stakeholders, repos, and related systems

| System | Relationship | Notes |
|--------|--------------|-------|
| Frontend SPA | API consumer | `GUIDE.md`, `CORS_ORIGINS` comment references Vercel staging |
| PostgreSQL | Primary datastore | Prisma migrations in `prisma/migrations/` |
| Redis | Cache, locks, SSE fan-out, BullMQ | Graceful degradation without `REDIS_URL` |
| Cloudinary | Image/file hosting | Team logos, flyers, statistician photos |
| Postman | API testing | `postman/Basketball_Management_API.postman_collection.json` |

`[UNKNOWN — needs owner input]` — Frontend repo URL, mobile apps, external stat feeds.

## Top 5 things the new team must know on day 1

1. **StatDash is event-sourced** — Game state is derived from `GameEvent` rows, not direct score PATCHes during live play. See [07-statdash-realtime.md](./07-statdash-realtime.md).

2. **Redis is optional but important in multi-instance deployments** — Without `REDIS_URL`, the app uses in-memory cache and disables BullMQ. SSE cross-node fan-out breaks. See [08-background-jobs-and-integrations.md](./08-background-jobs-and-integrations.md).

3. **Three roles with SUPER_ADMIN override** — `RolesGuard` always allows `SUPER_ADMIN`. StatDash projections controller omits `SUPER_ADMIN` in `@Roles` but super admins still pass. See `src/auth/guards/roles.guard.ts`.

4. **README is partially stale** — Lists future features (real-time, uploads) that are implemented. Trust handover docs and code over `README.md` "Future Enhancements".

5. **`npm run build` runs migrations** — The `build` script executes `prisma migrate deploy` before `nest build`. Understand implications for deploy pipelines. See `package.json`.

## Known risks, tech debt, and blockers

| Risk | Severity | Detail |
|------|----------|--------|
| No CI/CD in repo | High | No automated test gate on merge |
| `POST /api/upload` unauthenticated | High | `upload.controller.ts` has no guards |
| `POST /api/auth/register` open | Medium | No role restriction on self-registration |
| Refresh tokens issued but no refresh endpoint | Medium | Clients cannot renew without re-login |
| Session `expires` hardcoded 24h | Low | Ignores `JWT_EXPIRES_IN` in `auth.service.ts` |
| StatDash session completion not implemented | Medium | `COMPLETED`/`PAUSED`/`CANCELLED` exist in schema but no transitions |
| Box score vs score replay inconsistency | Medium | Corrections affect score replay but not raw box-score builder |
| Docker Compose disabled | Low | Local Postgres setup undocumented in working compose file |
| Deduplication threshold docs vs code | Low | Docs say 98%; code uses 75% |
| Winston logger unused | Low | `src/logger/logger.ts` not imported |

Full register: [14-known-issues-and-roadmap.md](./14-known-issues-and-roadmap.md).
