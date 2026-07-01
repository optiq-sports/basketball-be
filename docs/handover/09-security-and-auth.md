# 09 — Security and Auth

[← Background Jobs](./08-background-jobs-and-integrations.md) | [Index](./README.md) | [Next: Observability →](./10-observability-and-ops.md)

## Authentication mechanisms

| Mechanism | Used | Details |
|-----------|------|---------|
| JWT Bearer | Yes | Primary API auth |
| Local (email/password) | Yes | Login only via Passport |
| Refresh token | Partial | Issued but no refresh endpoint |
| API keys | No | — |
| Session cookie | No | Token in `Session` table for audit, not cookie-based |

### JWT configuration

**File:** `src/auth/auth.module.ts`

| Setting | Env var | Default |
|---------|---------|---------|
| Secret | `JWT_SECRET` | `'your-secret-key'` (fallback — **unsafe in prod**) |
| Access TTL | `JWT_EXPIRES_IN` | `'24h'` |
| Refresh TTL | `JWT_REFRESH_EXPIRES_IN` | `'7d'` (sign only; no endpoint) |

### Token extraction

`jwtFromBearerOrQuery` in `src/auth/strategies/jwt.strategy.ts`:
1. `Authorization: Bearer <token>`
2. Query param `access_token` (for SSE EventSource)

### Session persistence

On login/register, `auth.service.ts` creates `Session` with:
- `access_token` (same string as JWT)
- `refreshToken`
- `expires` — **hardcoded +24 hours** (ignores `JWT_EXPIRES_IN`)

No logout, revocation, or session cleanup job.

## Role-based access control

### Roles

| Role | Capabilities |
|------|--------------|
| `SUPER_ADMIN` | All routes; exclusive `/api/admin`; bypasses `@Roles` checks |
| `ADMIN` | CRUD except super-admin; delete on core resources; manage statisticians |
| `STATISTICIAN` | Create/update players, teams, tournaments, matches, StatDash; no deletes on core resources |

### SUPER_ADMIN override

```typescript
// src/auth/guards/roles.guard.ts
if (user?.role === Role.SUPER_ADMIN) {
  return true;
}
```

Even if `@Roles` omits `SUPER_ADMIN` (e.g. StatDash projections), super admins still access.

### Endpoint access matrix (summary)

| Resource | Read | Create/Update | Delete |
|----------|------|---------------|--------|
| Auth profile | JWT | register/login open | — |
| Players | JWT | ADMIN, STATISTICIAN | ADMIN |
| Teams | JWT | ADMIN, STATISTICIAN | ADMIN |
| Tournaments | JWT | ADMIN, STATISTICIAN | ADMIN |
| Matches | JWT | ADMIN, STATISTICIAN | ADMIN |
| Admin users | SUPER_ADMIN | SUPER_ADMIN | SUPER_ADMIN |
| Statisticians | ADMIN+ | ADMIN+ | ADMIN+ |
| StatDash | STATISTICIAN+ | STATISTICIAN+ | correct/reverse |
| Upload (generic) | **Public** | **Public** | — |
| Ops queues | ADMIN+ | ADMIN+ | — |

## Password hashing

- **Library:** bcrypt (`bcrypt.hash(password, 10)`)
- **Files:** `auth.service.ts`, `admin.service.ts`, `statistician.service.ts`, `prisma/seed.ts`

## CORS

**File:** `src/main.ts`

| `CORS_ORIGINS` | Behavior |
|----------------|----------|
| Unset / empty | `origin: true` (reflect request origin) |
| Set | Comma-separated exact match allowlist |

Also enabled: `credentials: true`, standard HTTP methods, headers include `Authorization`.

## Input validation

| Layer | Mechanism |
|-------|-----------|
| Global | `ValidationPipe` — whitelist, forbidNonWhitelisted, transform |
| DTOs | class-validator decorators on all DTOs |
| StatDash payloads | Per-command DTO mapping in `validate-command-payload.ts` |
| Prisma | Unique constraints surfaced as 409 |

No Helmet middleware found in `main.ts` or `app.module.ts`.

## Sensitive data handling

| Data | Handling |
|------|----------|
| Passwords | bcrypt hashed; stripped from `validateUser` return |
| JWT secret | Env var; weak default if missing |
| Cloudinary secrets | Env vars |
| Database URL | Env var |
| PII (player email, phone) | Stored in PostgreSQL; no field-level encryption |

## Known security gaps / recommendations

| Gap | Severity | Location | Recommendation |
|-----|----------|----------|----------------|
| Open registration with role selection | High | `auth.controller.ts` | Restrict register in prod; bootstrap SUPER_ADMIN separately |
| Unauthenticated upload | High | `upload.controller.ts` | Add JWT + role guard |
| No rate limiting | Medium | — | Add throttler on auth endpoints |
| JWT default secret fallback | High | `jwt.strategy.ts`, `auth.module.ts` | Fail startup if `JWT_SECRET` missing in prod |
| No token revocation | Medium | `auth.service.ts` | Logout endpoint + session invalidation |
| Refresh token unused | Low | — | Implement refresh or remove from response |
| No Helmet | Low | `main.ts` | Add security headers |
| CORS allow-all when unset | Medium | `main.ts` | Set explicit `CORS_ORIGINS` in prod |
| Seed default password | High | `prisma/seed.ts` | Never run seed in prod with defaults |

## Cross-references

- API auth flows: [04-api-reference.md](./04-api-reference.md#authentication-flow)
- Runbook for auth failures: [13-runbooks.md](./13-runbooks.md)
