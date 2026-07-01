# 13 — Runbooks

[← Configuration](./12-configuration-and-environments.md) | [Index](./README.md) | [Next: Known Issues →](./14-known-issues-and-roadmap.md)

## Deploy a new version

`[UNKNOWN — needs owner input]` — Hosting not in repo. Generic procedure:

1. **Pre-deploy**
   - Merge to release branch
   - Run `npm test` and `npm run test:e2e`
   - Review pending Prisma migrations

2. **Build**
   ```bash
   npm ci
   npm run build:app
   ```

3. **Migrate** (on target DB)
   ```bash
   npx prisma migrate deploy
   ```

4. **Deploy artifact**
   - Copy `dist/`, `node_modules` (or `npm ci --omit=dev` on server), `prisma/`
   - Set environment variables
   ```bash
   npm run start:prod
   ```

5. **Post-deploy**
   - Smoke test login + one CRUD endpoint
   - If StatDash active: bootstrap test session
   - Check queue health if Redis enabled

## Run migrations safely in production

1. **Backup database** before migration
2. Run `npx prisma migrate status` — verify pending migrations
3. Apply: `npx prisma migrate deploy` (never `migrate dev` in prod)
4. Verify: `npx prisma migrate status` shows up to date
5. Deploy app code **after** migrations if migration adds columns tables the new code expects

### StatDash migration note

`20260502000000_add_statdash_tables` adds significant tables. Ensure app version supports StatDash before or with migration.

### Rollback

Prisma has no automatic down migrations. Forward-fix preferred. Restore from backup only as last resort.

## Rotate credentials

### JWT_SECRET

1. Generate new secret
2. Update env in all running instances
3. **All existing tokens invalidate immediately** — users must re-login
4. Optional: purge `session` table

### DATABASE_URL

1. Create new DB user/password in Postgres
2. Update connection string in secret store
3. Rolling restart app instances
4. Revoke old DB credentials

### Cloudinary

1. Rotate API secret in Cloudinary dashboard
2. Update `CLOUDINARY_API_SECRET` in env
3. Restart app

### Redis

1. Update `REDIS_URL` if endpoint/credentials change
2. Restart app (BullMQ in-flight jobs may fail — check DLQ)

`[UNKNOWN — needs owner input]` — Document who performs rotations and approval process.

---

## Debug: API 500 errors

1. **Check logs** — NestJS Logger stdout; look for stack trace from `HttpExceptionFilter`
2. **Identify path** — Error response includes `path`, `method`, `timestamp`
3. **Prisma codes**
   - `P1001` — DB unreachable → check Postgres, network, `DATABASE_URL`
   - `P2021`/`P2022` — Schema mismatch → run `prisma migrate deploy`
   - `P2002` — Unique violation → data conflict
4. **StatDash** — Check for transaction timeout (30s) under load
5. **Reproduce locally** with same payload and DB snapshot

## Debug: Auth failures

| Symptom | Check |
|---------|-------|
| 401 on all routes | Token expired; `JWT_SECRET` changed; malformed Bearer header |
| 401 on SSE only | Pass `access_token` query param — EventSource cannot send headers |
| 403 Forbidden | User role insufficient; check `@Roles` on endpoint |
| Login fails | User exists? `bcrypt` password correct? `User.status` ACTIVE? |
| SUPER_ADMIN can't access admin | User role must be exactly `SUPER_ADMIN` in DB |

Verify JWT payload: decode at jwt.io (dev only) — `sub`, `email`, `role`.

No refresh endpoint — client must call `POST /auth/login` again.

## Debug: DB connection issues

```bash
npx prisma migrate status
npx prisma db execute --stdin <<< "SELECT 1"
```

| Error | Action |
|-------|--------|
| Connection refused | Postgres down, wrong host/port |
| SSL required | Add `?sslmode=require` to URL (common on managed Postgres) |
| Too many connections | Enable pooling or reduce app instances |
| Schema drift | `prisma migrate deploy` |

Filter maps P1001 to HTTP 503 with message "Cannot reach the database server."

## Debug: Redis / queue failures

### Redis unset (expected in some envs)

Logs: `"REDIS_URL not set, using in-memory fallback cache"`

App works single-instance; queues disabled.

### Redis connection errors

1. Verify `REDIS_URL` format: `redis://host:6379`
2. Check network/firewall
3. BullMQ requires `maxRetriesPerRequest: null` on its connection (already set in code)

### Queue backlog

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://<api>/api/ops/queues/lag
```

### DLQ recovery

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://<api>/api/ops/queues/dead-letter/requeue?limit=25"
```

### Warm session caches

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://<api>/api/ops/queues/warm/session?sessionId=<id>"
```

## Debug: StatDash session desync

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Score wrong vs events | Missed correction replay | `POST .../projections/match/:sessionId/rebuild` |
| Client stale UI | SSE disconnected | Reconnect with `?sinceVersion=<last>` |
| 409 version conflict | Concurrent writes | Refresh state; retry with latest `version` |
| Duplicate events on retry | Missing idempotency key | Always send stable `idempotencyKey` per user action |
| Lock busy | Concurrent command | Retry after short delay |
| Box score ≠ session score | Box score ignores reversals | Use rebuild; known gap — see [07-statdash-realtime.md](./07-statdash-realtime.md) |
| Multi-instance SSE missing updates | Redis pub/sub down | Verify `REDIS_URL` on all nodes |

### Recovery sequence

1. `GET /api/statdash/sessions/:sessionId/state` — get `version`
2. `POST /api/statdash/projections/match/:sessionId/rebuild`
3. Verify `Match.homeScore` / `MatchStat` rows in DB
4. Reconnect SSE with correct `sinceVersion`

---

## Incident response

`[UNKNOWN — needs owner input]`

| Role | Contact |
|------|---------|
| Engineering lead | _____________ |
| On-call | _____________ |
| Database admin | _____________ |
| Product owner | _____________ |

### Escalation triggers

- API down > 5 minutes
- Data loss or incorrect published scores
- Auth bypass suspected
- Database corruption

### Communication

Document status page / Slack channel with outgoing team.
