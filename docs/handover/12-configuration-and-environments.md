# 12 — Configuration and Environments

[← Testing](./11-testing.md) | [Index](./README.md) | [Next: Runbooks →](./13-runbooks.md)

## Configuration files

| File | Purpose |
|------|---------|
| `.env` | Runtime secrets (gitignored) — loaded by `ConfigModule` |
| `.env.example` | Template for required/optional vars |
| `package.json` | Scripts, dependencies, Jest config |
| `nest-cli.json` | NestJS CLI build options |
| `tsconfig.json` | TypeScript compiler options |
| `tsconfig.build.json` | Build-specific TS excludes |
| `prisma/schema.prisma` | Database schema + generator |
| `prisma/migrations/` | SQL migration history |
| `docker-compose.yaml` | Local Postgres/pgAdmin (**commented out**) |
| `test/jest-e2e.json` | E2E Jest config |
| `.vscode/settings.json` | Editor settings |

No `prisma.config.ts` (Prisma 6 style config not used).

## Environment variables (complete list)

### Documented in `.env.example`

| Variable | Build / Runtime | Required |
|----------|-----------------|----------|
| `DATABASE_URL` | Runtime | Yes |
| `JWT_SECRET` | Runtime | Yes |
| `JWT_EXPIRES_IN` | Runtime | No |
| `CORS_ORIGINS` | Runtime | No |
| `CLOUDINARY_CLOUD_NAME` | Runtime | For uploads |
| `CLOUDINARY_API_KEY` | Runtime | For uploads |
| `CLOUDINARY_API_SECRET` | Runtime | For uploads |

### Used in code only

| Variable | Build / Runtime | Default | File reference |
|----------|-----------------|---------|----------------|
| `PORT` | Runtime | 3000 | `src/main.ts` |
| `REDIS_URL` | Runtime | unset | `redis.service.ts`, `queue.service.ts` |
| `JWT_REFRESH_EXPIRES_IN` | Runtime | 7d | `auth.service.ts` |
| `LOG_LEVEL` | Runtime (unused) | info | `src/logger/logger.ts` |

### Commented future vars

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION` in `.env.example`.

## Per-environment differences

| Aspect | Local dev | Staging / Prod (inferred) |
|--------|-----------|---------------------------|
| `DATABASE_URL` | Local Postgres | Managed Postgres |
| `REDIS_URL` | Often unset locally | Likely required for multi-instance |
| `JWT_SECRET` | Dev secret | Strong random secret |
| `CORS_ORIGINS` | Unset or localhost:5173 | Explicit frontend URLs |
| `CLOUDINARY_*` | Dev cloud | Prod cloud / folder |
| Migrations | `migrate dev` | `migrate deploy` |
| Seed | Run manually | **Should not** use default seed creds |

`[UNKNOWN — needs owner input]` — Provide env inventory per environment.

## Feature flags

**None implemented.** No feature flag library or env-based toggles in code.

## Build vs runtime config

| Config | When applied |
|--------|--------------|
| `JWT_SECRET`, `DATABASE_URL` | Runtime only (ConfigModule) |
| `prisma generate` | Build time (`build`, `build:app`) |
| `prisma migrate deploy` | Build time in `npm run build` only |
| TypeScript compilation | Build time → `dist/` |
| CORS, ValidationPipe | Runtime in `main.ts` |

### Recommended CI split

```bash
# CI build (no DB required)
npm run build:app

# Deploy step (DB required)
npx prisma migrate deploy
node dist/main.js
```

## Secrets management

### Local

Secrets in `.env` file (not committed). Template in `.env.example`.

### Production

`[UNKNOWN — needs owner input]` — Describe process:
- Hosting provider secret store (Vercel env, Railway, AWS SSM, etc.)
- Who can rotate secrets
- Whether `DATABASE_URL` uses connection pooling (PgBouncer, Neon, etc.)

### Never commit

- `.env`
- Real Cloudinary secrets
- Production `JWT_SECRET`
- `execution_log.txt` (exists in repo — review for sensitive content)

## NestJS ConfigModule

```typescript
// src/app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ".env",
});
```

Single `.env` file — no `.env.production` switching in code.

## Cross-references

- Setup: [03-getting-started.md](./03-getting-started.md)
- Security: [09-security-and-auth.md](./09-security-and-auth.md)
