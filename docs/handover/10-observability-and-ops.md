# 10 — Observability and Operations

[← Security](./09-security-and-auth.md) | [Index](./README.md) | [Next: Testing →](./11-testing.md)

## Logging

### Runtime logging (active)

**Wired globally in** `src/app.module.ts`:

| Component | File | Behavior |
|-----------|------|----------|
| Request logging | `src/common/interceptors/logging.interceptor.ts` | Logs method, URL, duration, query/params/body size on success; errors on failure |
| Error logging | `src/common/filters/http-exception.filter.ts` | 5xx → `error` + stack; 4xx → `warn` + JSON body |
| Service logs | Various `Logger` in services | Contextual info/warn |

Uses NestJS built-in `Logger` — **not** Winston at runtime.

### Winston (unused)

**File:** `src/logger/logger.ts`

```typescript
level: process.env.LOG_LEVEL || "info"
format: timestamp + json()
transports: [Console]
```

Not imported anywhere in `src/`. Dead code unless wired in future.

### Log destination

Stdout/stderr only. No file rotation, log aggregation, or APM integration in repo.

`[UNKNOWN — needs owner input]` — Where do production logs go (CloudWatch, Datadog, etc.)?

## Health checks

| Endpoint | Exists? | Notes |
|----------|---------|-------|
| `/api/health` | **No** | — |
| `/api/ops/queues/health` | Yes | Queue job counts; requires ADMIN JWT |
| Implicit | DB connectivity | Failed queries return 503 via Prisma error mapping |

### Suggested health check for load balancers

Not implemented. Could use:
- `GET /api/auth/login` — not ideal (side effects)
- Add dedicated health module — **not in repo**

## Monitoring

No Prometheus, OpenTelemetry, Sentry, or health probe configuration in repository.

## Deployment process

`[UNKNOWN — needs owner input]` — No CI/CD, Dockerfile, or deploy scripts found in repo.

### Build artifact

```bash
npm run build    # prisma generate + migrate deploy + nest build
npm run start:prod
```

Output: `dist/main.js` (compiled NestJS app).

### Build script caveat

`npm run build` runs `prisma migrate deploy` — ensure DB is reachable at build time or use `build:app` in CI and run migrations as separate deploy step.

## Environments

| Environment | Evidence |
|-------------|----------|
| Local dev | `npm run dev`, localhost:3000 |
| Staging | `CORS_ORIGINS` comment mentions `basketball-staging.vercel.app` |
| Production | `[UNKNOWN — needs owner input]` |

## CI/CD pipeline

**Not present.** No `.github/workflows`, GitLab CI, Jenkins, or similar.

Recommended pipeline (to be implemented by incoming team):

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run test:e2e` (with test DB)
5. `npm run build:app`
6. Deploy `dist/` + run `prisma migrate deploy`

## Database backup / restore

Not documented in repo.

`[UNKNOWN — needs owner input]`:
- Backup frequency and tooling (pg_dump, managed provider snapshots)
- RPO/RTO expectations
- Whether StatDash event log needs point-in-time recovery

## Rollback procedure

`[UNKNOWN — needs owner input]` — Suggested approach:

1. Redeploy previous application artifact
2. **Do not** roll back migrations without DBA review (StatDash migrations add tables)
3. If migration already applied, forward-fix preferred over `migrate down`

Prisma does not generate down migrations by default.

## Performance considerations

| Area | Notes |
|------|-------|
| StatDash command path | Prisma transaction + Redis lock per command — bottleneck under high write rate |
| Session snapshot cache | 30s TTL reduces DB reads |
| Projection cache | 60s TTL |
| Player deduplication | Fuzzy match scans players — may slow bulk import |
| N+1 queries | Mitigated partially via Prisma `include` in services |
| Multi-instance | Requires Redis for consistent cache, locks, SSE fan-out |
| BullMQ workers | Concurrency 5 per queue; mostly cache invalidation (lightweight) |

### Bottlenecks to watch

1. StatDash write contention on single `GameSession.version`
2. Large `GameEvent` tables — replay for corrections is O(n events)
3. Missing DB connection pooling config in repo (may use Prisma defaults)

## Cross-references

- Queue ops: [08-background-jobs-and-integrations.md](./08-background-jobs-and-integrations.md)
- Runbooks: [13-runbooks.md](./13-runbooks.md)
- Config: [12-configuration-and-environments.md](./12-configuration-and-environments.md)
