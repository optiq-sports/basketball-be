# 11 — Testing

[← Observability](./10-observability-and-ops.md) | [Index](./README.md) | [Next: Configuration →](./12-configuration-and-environments.md)

## Test pyramid

```
        /\
       /  \  E2E (3 specs, 1 trivial)
      /----\
     /      \  Integration-ish (StatDash service specs)
    /--------\
   /          \  Unit (auth, players, rules, queue, realtime)
  /--------------\
```

| Layer | Count | Location |
|-------|-------|----------|
| Unit | 10 spec files | `src/**/*.spec.ts` |
| E2E | 3 spec files | `test/*.e2e-spec.ts` |
| Manual scripts | 2 | `test/manual-verify.ts`, `test/service-verify.ts` |

## How to run tests

| Command | Purpose |
|---------|---------|
| `npm test` | All unit tests (`src/**/*.spec.ts`) |
| `npm run test:watch` | Watch mode |
| `npm run test:cov` | Coverage report → `coverage/` |
| `npm run test:e2e` | E2E via `test/jest-e2e.json` |
| `npm test -- statdash-events.service.spec.ts` | Single file |
| `npm run test:e2e -- statdash-verification.e2e-spec.ts` | StatDash E2E only |

### E2E configuration

**File:** `test/jest-e2e.json`
- `testRegex`: `.e2e-spec.ts$`
- `moduleNameMapper`: `src/*` → `../src/*`

E2E tests require running app + database (`DATABASE_URL` in environment).

## Key test files

### Auth

| File | Verifies |
|------|----------|
| `src/auth/auth.service.spec.ts` | Login, register, validateUser |
| `src/auth/strategies/jwt.strategy.spec.ts` | Bearer + query token extraction |

### Players

| File | Verifies |
|------|----------|
| `src/players/players.service.spec.ts` | CRUD, dedup integration (mocked) |

### StatDash

| File | Verifies |
|------|----------|
| `src/statdash/events/statdash-events.service.spec.ts` | Idempotency, version conflict, correct/reverse, realtime publish |
| `src/statdash/events/rules/statdash-rules.spec.ts` | Shot, rebound, block, foul, turnover rule ordering |
| `src/statdash/events/dto/validate-command-payload.spec.ts` | Payload DTO validation |
| `src/statdash/sessions/statdash-sessions.service.spec.ts` | Bootstrap, resolveMatchKey, start guards |
| `src/statdash/projections/statdash-projections.service.spec.ts` | Score replay with correction/reversal |
| `src/statdash/realtime/statdash-realtime.service.spec.ts` | SSE stream, sinceVersion, Redis bridge |
| `test/statdash-verification.e2e-spec.ts` | E2E-01 through E2E-05 scenario matrix |

### Infrastructure

| File | Verifies |
|------|----------|
| `src/common/queue/queue.service.spec.ts` | Queue no-op without Redis, enqueue methods |

### E2E

| File | Verifies |
|------|----------|
| `test/sanity.e2e-spec.ts` | Trivial `expect(true).toBe(true)` only |
| `test/admin.e2e-spec.ts` | Admin CRUD (sets `REDIS_URL=""`) |
| `test/statdash-verification.e2e-spec.ts` | StatDash rule scenarios |

## Test data setup / teardown

| Approach | Detail |
|----------|--------|
| Unit tests | Mock Prisma, Redis, Queue services |
| E2E admin | Creates/deletes test users via API |
| E2E StatDash | Bootstraps sessions in test DB |
| Seed | `prisma/seed.ts` — not auto-run in tests |

No shared `test/setup.ts` or global teardown in repo.

## Coverage gaps (NOT tested)

| Area | Gap |
|------|-----|
| Teams service | No `teams.service.spec.ts` |
| Tournaments service | No spec |
| Matches service | No spec |
| Upload / Cloudinary | No spec |
| Admin / Statistician services | Only e2e for admin |
| Upload controller auth | No security tests |
| Auth register role escalation | No test |
| Full HTTP integration | Limited e2e coverage |
| StatDash session COMPLETED flow | Not implemented |
| Multi-instance SSE | Partial (realtime unit test mocks Redis) |
| Load / performance | None |
| Migrations | Not tested in CI |

## Manual QA checklist for releases

### Core API

- [ ] Login with seeded admin
- [ ] Create team → tournament → add team → create match
- [ ] Bulk create players for team
- [ ] Excel player upload
- [ ] JWT rejected on protected route without token (401)
- [ ] Statistician cannot DELETE team (403)

### StatDash

- [ ] Resolve match key by tournament code
- [ ] Bootstrap + start session
- [ ] Record shot, foul/FT sequence
- [ ] SSE stream receives updates
- [ ] Idempotent command retry
- [ ] Version conflict on stale expectedVersion
- [ ] Correct and reverse event; score updates
- [ ] Rebuild projections; verify MatchStat rows

### Ops

- [ ] Queue health with Redis enabled
- [ ] App starts cleanly with Redis disabled

### Regression

- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes against staging DB

## Verification documentation

`docs/statdash-be-verification-results.md` — formal verification matrix (2026-04-27) with PASS/PARTIAL status per scenario.

## Cross-references

- StatDash scenarios: [07-statdash-realtime.md](./07-statdash-realtime.md#testing-strategy)
- Local test setup: [03-getting-started.md](./03-getting-started.md#running-tests)
