# 03 — Getting Started

[← Architecture](./02-architecture-overview.md) | [Index](./README.md) | [Next: API Reference →](./04-api-reference.md)

## Prerequisites

| Requirement | Version / notes | Source |
|-------------|-----------------|--------|
| Node.js | 18+ (README); devDeps use `@types/node` ^24 | `README.md`, `package.json` |
| npm | Default package manager | `package-lock.json` present |
| PostgreSQL | Running instance with connection URL | `DATABASE_URL` |
| Redis | Optional; required for BullMQ + multi-node SSE | `REDIS_URL` |
| Cloudinary account | Optional; for file uploads | `.env.example` |
| Docker | Mentioned in README but compose file is commented out | `docker-compose.yaml` |

Bun is mentioned in `README.md` as optional; all scripts work with npm.

## Clone and install

```bash
git clone <repo-url> basketball-be
cd basketball-be
npm install
```

## Environment setup

Copy the template:

```bash
cp .env.example .env
```

### Environment variables

Variables in `.env.example`:

| Variable | Required | Purpose | Example (non-secret) |
|----------|----------|---------|----------------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string for Prisma | `postgresql://user:password@localhost:5432/basketball_db?schema=public` |
| `JWT_SECRET` | **Yes** | JWT signing secret | `change-me-in-production` |
| `JWT_EXPIRES_IN` | No | Access token TTL (JwtModule) | `7d` (example default in `.env.example`) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins; if unset, all origins allowed | `http://localhost:5173,https://app.example.com` |
| `CLOUDINARY_CLOUD_NAME` | For uploads | Cloudinary cloud name | `my-cloud` |
| `CLOUDINARY_API_KEY` | For uploads | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | For uploads | Cloudinary API secret | `your-secret` |

Variables used in code but **not** in `.env.example`:

| Variable | Required | Purpose | Default |
|----------|----------|---------|---------|
| `PORT` | No | HTTP listen port | `3000` (`src/main.ts`) |
| `REDIS_URL` | No | Redis + BullMQ; if unset, in-memory fallback | — |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token JWT TTL | `7d` (`auth.service.ts`) |
| `LOG_LEVEL` | No | Winston level (unused at runtime) | `info` (`src/logger/logger.ts`) |

Commented in `.env.example` (future S3): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`.

## Database setup

### Generate Prisma client

```bash
npm run prisma:generate
```

### Run migrations (development)

```bash
npm run prisma:migrate
# equivalent: npx prisma migrate dev
```

### Seed default admin

```bash
npm run seed
```

Creates:
- Email: `test@basketball.com`
- Password: `password123`
- Role: `ADMIN`

See `prisma/seed.ts`. **Change credentials after first login in any shared environment.**

### Reset database (destructive)

```bash
npx prisma migrate reset
```

Prompts for confirmation; runs migrations and seed if configured.

### Prisma Studio

```bash
npm run prisma:studio
```

## Local run commands

| Script | Command | What it does |
|--------|---------|--------------|
| Development | `npm run dev` | `nest start --watch` |
| Debug | `npm run start:debug` | Nest debug + watch |
| Build (with migrate) | `npm run build` | `prisma generate` → `prisma migrate deploy` → `nest build` |
| Build (app only) | `npm run build:app` | `prisma generate` → `nest build` |
| Start (build + run) | `npm start` | `build:app` then `node dist/main.js` |
| Production | `npm run start:prod` | `node dist/main.js` (expects prior build) |

API base URL: `http://localhost:3000/api` (or `PORT` override).

## Docker Compose

`docker-compose.yaml` exists but **all services are commented out**. The README describes Postgres on `5432` and pgAdmin on `5050`, but that configuration is not active in the current file.

To use Docker locally, either:
1. Uncomment and adjust `docker-compose.yaml`, or
2. Run PostgreSQL another way and set `DATABASE_URL` accordingly.

`[UNKNOWN — needs owner input]` — How does the current team run Postgres locally?

## Redis (optional)

For full StatDash async processing and multi-instance SSE:

```env
REDIS_URL=redis://localhost:6379
```

Without it, the app logs warnings and uses in-memory cache (`redis.service.ts`, `queue.service.ts`).

## Running tests

### Unit tests

```bash
npm test
npm run test:cov    # with coverage
npm run test:watch  # watch mode
```

Unit tests live under `src/**/*.spec.ts`.

### E2E tests

```bash
npm run test:e2e
```

Requires a reachable `DATABASE_URL`. `test/admin.e2e-spec.ts` sets `REDIS_URL=""` to disable Redis.

| E2E file | Purpose |
|----------|---------|
| `test/sanity.e2e-spec.ts` | Trivial pass (smoke) |
| `test/admin.e2e-spec.ts` | Admin CRUD flows |
| `test/statdash-verification.e2e-spec.ts` | StatDash rule scenarios E2E-01–05 |

## Verify the app is healthy

1. Start Postgres and apply migrations.
2. `npm run dev`
3. Register or seed admin:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@basketball.com","password":"password123"}'
   ```
4. Expect wrapped response:
   ```json
   { "success": true, "data": { "access_token": "...", "user": { ... } }, "timestamp": "..." }
   ```
5. Call protected endpoint:
   ```bash
   curl http://localhost:3000/api/auth/profile \
     -H "Authorization: Bearer <access_token>"
   ```
6. If Redis enabled, queue health (admin JWT):
   ```bash
   curl http://localhost:3000/api/ops/queues/health \
     -H "Authorization: Bearer <access_token>"
   ```

There is **no** dedicated `/api/health` liveness endpoint.

## Common setup failures and fixes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `P1001` Cannot reach database | Postgres not running / wrong URL | Check `DATABASE_URL`, start DB |
| `P2021` / `P2022` schema errors | Migrations not applied | `npx prisma migrate deploy` |
| Prisma Client not found | Client not generated | `npm run prisma:generate` |
| Port in use | Another process on 3000 | Set `PORT=3001` in `.env` |
| Upload fails | Missing Cloudinary env | Set `CLOUDINARY_*` vars |
| E2E StatDash DB tests skip/fail | No DB connectivity | Ensure test DB URL; see `docs/statdash-be-verification-results.md` |
| `build` fails on migrate | DB unreachable during CI build | Use `build:app` in CI if migrations run separately |

## Next steps

- Import Postman collection: `postman/Basketball_Management_API.postman_collection.json`
- Read [04-api-reference.md](./04-api-reference.md) for endpoints
- Read [07-statdash-realtime.md](./07-statdash-realtime.md) before integrating live stats
