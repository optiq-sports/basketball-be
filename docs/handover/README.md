# Basketball Backend — Project Transition Handover

This folder contains complete handover documentation for the **basketball-be** repository (Optiq Sport). It was generated from code inspection and existing project docs. Prefer **code** over older README claims when they conflict.

## Quick links

| # | Document | Description |
|---|----------|-------------|
| 1 | [01-executive-summary.md](./01-executive-summary.md) | What the project is, maturity, risks, day-1 essentials |
| 2 | [02-architecture-overview.md](./02-architecture-overview.md) | System diagram, request lifecycle, module structure |
| 3 | [03-getting-started.md](./03-getting-started.md) | Local setup, env vars, DB, tests, troubleshooting |
| 4 | [04-api-reference.md](./04-api-reference.md) | Full endpoint inventory, auth, response formats |
| 5 | [05-data-model.md](./05-data-model.md) | Prisma schema, ER diagram, migrations, seed |
| 6 | [06-core-domains.md](./06-core-domains.md) | Auth, Admin, Players, Teams, Tournaments, Matches, Upload |
| 7 | [07-statdash-realtime.md](./07-statdash-realtime.md) | Event-sourced live stats subsystem (deep dive) |
| 8 | [08-background-jobs-and-integrations.md](./08-background-jobs-and-integrations.md) | BullMQ, Redis, Cloudinary, queues |
| 9 | [09-security-and-auth.md](./09-security-and-auth.md) | JWT, RBAC, CORS, validation, gaps |
| 10 | [10-observability-and-ops.md](./10-observability-and-ops.md) | Logging, health, deployment, CI/CD |
| 11 | [11-testing.md](./11-testing.md) | Unit/e2e tests, coverage gaps, QA checklist |
| 12 | [12-configuration-and-environments.md](./12-configuration-and-environments.md) | Config files, env differences, secrets |
| 13 | [13-runbooks.md](./13-runbooks.md) | Deploy, migrate, debug production issues |
| 14 | [14-known-issues-and-roadmap.md](./14-known-issues-and-roadmap.md) | Tech debt, contradictions, planned work |
| 15 | [15-glossary-and-conventions.md](./15-glossary-and-conventions.md) | Domain terms, code conventions, recipes |
| 16 | [16-handover-checklist.md](./16-handover-checklist.md) | Outgoing/incoming team checklist |

## Related repo assets

| Asset | Path |
|-------|------|
| Postman collection | `postman/Basketball_Management_API.postman_collection.json` |
| Frontend integration guide | `GUIDE.md` |
| System design (older) | `SYSTEM_DESIGN.md` |
| Implementation summary (older) | `IMPLEMENTATION_SUMMARY.md` |
| StatDash verification results | `docs/statdash-be-verification-results.md` |
| Prisma schema | `prisma/schema.prisma` |
| Environment template | `.env.example` |

## Documentation coverage report

See the [Coverage Report](#documentation-coverage-report) at the bottom of this file.

---

## Documentation coverage report

### Documented from repo

- Full NestJS module layout (`src/app.module.ts`, all domain modules)
- Prisma data model (18 models, 7 enums) and migration history
- All HTTP controllers and role guards (verified via grep + file reads)
- StatDash event-sourced subsystem (sessions, events, projections, SSE realtime)
- BullMQ queues, Redis caching/locks/pub-sub, Cloudinary upload
- Auth flow (JWT, Passport, session persistence)
- Test inventory (10 unit spec files, 3 e2e specs)
- Env vars from `.env.example` plus runtime vars found in code (`REDIS_URL`, `PORT`, etc.)

### Could not be determined from repo alone

| Item | What was checked | Follow-up for outgoing team |
|------|------------------|----------------------------|
| Production URL(s) | No deploy configs in repo | Provide staging/prod API URLs |
| CI/CD pipeline | No `.github/workflows` or similar | Document build/deploy pipeline |
| Hosting provider | Not in repo | Vercel/Railway/AWS/etc.? |
| Frontend repo URL | Referenced in `CORS_ORIGINS` comment only | Link frontend repo and env |
| Production secrets store | Not in repo | How are env vars managed in prod? |
| On-call / escalation | Not in repo | Names, channels, SLAs |
| DB backup schedule | Not in repo | RPO/RTO expectations |
| Bun vs Node in production | README mentions Bun; `package.json` uses npm scripts | Confirm runtime in prod |
| Docker Compose for local DB | `docker-compose.yaml` is fully commented out | Is Postgres hosted elsewhere locally? |

### Contradictions (code preferred)

| Topic | Older docs say | Code says |
|-------|----------------|-----------|
| Real-time stats | README "Future: WebSocket" | StatDash SSE at `/api/statdash/realtime/...` |
| Deduplication threshold | `SYSTEM_DESIGN.md` / `IMPLEMENTATION_SUMMARY.md`: 98% | `player-deduplication.service.ts`: `FUZZY_THRESHOLD = 75.0` |
| Env file name | README: `.env-sample` | Actual: `.env.example` |
| Docker Compose | README: active postgres/pgAdmin | `docker-compose.yaml`: all services commented out |
| Roles | README: ADMIN, STATISTICIAN only | Schema + guards: `SUPER_ADMIN`, `ADMIN`, `STATISTICIAN` |

### Recommended follow-up questions

1. Where is this API deployed today (staging/prod URLs)?
2. Is Redis required in production, or does in-memory fallback run anywhere?
3. Who provisions the first `SUPER_ADMIN` user?
4. Is `POST /api/auth/register` open in production or should it be disabled?
5. Should `POST /api/upload` remain unauthenticated?
6. What is the frontend repo and how does it consume StatDash SSE?
7. Are there pending migrations not yet applied in production?
