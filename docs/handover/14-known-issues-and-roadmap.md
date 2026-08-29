# 14 — Known Issues, Tech Debt, and Roadmap

[← Runbooks](./13-runbooks.md) | [Index](./README.md) | [Next: Glossary →](./15-glossary-and-conventions.md)

## Documentation vs code contradictions

| Status | Topic                   | Stale doc                                            | Actual code                            | Priority                  |
| ------ | ----------------------- | ---------------------------------------------------- | -------------------------------------- | ------------------------- |
| ❌ Open | Real-time stats         | `README.md` lists as future                          | StatDash SSE implemented               | Update README             |
| ❌ Open | File upload             | `README.md` lists as future                          | Cloudinary upload implemented          | Update README             |
| ❌ Open | Deduplication threshold | `SYSTEM_DESIGN.md`, `IMPLEMENTATION_SUMMARY.md`: 98% | `player-deduplication.service.ts`: 75% | Update docs or align code |
| ❌ Open | Env file name           | `README.md`: `.env-sample`                           | `.env.example`                         | Update README             |
| ❌ Open | Docker Compose          | `README.md`: active services                         | `docker-compose.yaml` fully commented  | Restore or update README  |
| ❌ Open | Roles                   | `README.md`: ADMIN, STATISTICIAN                     | `SUPER_ADMIN` added in schema          | Update README             |
| ❌ Open | RBAC matrix             | `SYSTEM_DESIGN.md` omits SUPER_ADMIN                 | Full 3-role model                      | Update SYSTEM_DESIGN      |

## Open bugs and workarounds

| Status | Issue                                 | Workaround                                            | Files                             |
| ------ | ------------------------------------- | ----------------------------------------------------- | --------------------------------- |
| ✅ Done | Box score ignores correction/reversal | Use `replayScoreFromEvents` path via rebuild endpoint | `statdash-projections.service.ts` |
| ✅ Done | Session COMPLETED never set           | Manually PATCH match status                           | `statdash-sessions.service.ts`    |
| ✅ Done | Match stat sync worker no-ops         | Call `POST .../rebuild` for DB sync                   | `queue-worker.service.ts`         |
| ✅ Done | Refresh token unusable                | Re-login                                              | `auth.service.ts`                 |
| ✅ Done | No `/api/health`                      | Use login smoke test or add endpoint                  | —                                 |

No `TODO`/`FIXME` comments found in `src/` via grep.

## Incomplete features / WIP

| Status | Feature                                 | State                        | Evidence                                   |
| ------ | --------------------------------------- | ---------------------------- | ------------------------------------------ |
| ✅ Done | Game session PAUSED/COMPLETED/CANCELLED | Schema only                  | No service transitions                     |
| ✅ Done | Clock/possession from commands          | Events logged only           | `statdash-events.service.ts`               |
| ❌ Open | S3 upload provider                      | Commented env vars           | `.env.example`                             |
| ✅ Done | Winston structured logging              | File exists, unwired         | `src/logger/logger.ts`                     |
| ✅ Done | Refresh token endpoint                  | Not implemented              | —                                          |
| ✅ Done | Logout / session revocation             | Not implemented              | —                                          |
| ✅ Done | API rate limiting                       | Not implemented              | —                                          |
| ❌ Open | Swagger/OpenAPI                         | Not implemented              | README future list                         |
| ❌ Open | Tournament standings                    | Not implemented              | README future list                         |
| ❌ Open | Email notifications                     | Not implemented              | README future list                         |
| ❌ Open | Advanced jersey validation              | PARTIAL per verification doc | `docs/statdash-be-verification-results.md` |

## Technical debt register

| Status | Area                   | Issue                              | Suggested fix                             | Priority |
| ------ | ---------------------- | ---------------------------------- | ----------------------------------------- | -------- |
| ✅ Done | `upload.controller.ts` | No auth                            | Add JwtAuthGuard + RolesGuard             | P0       |
| ✅ Done | `auth.controller.ts`   | Open register with role            | Disable or restrict to SUPER_ADMIN        | P0       |
| ❌ Open | CI/CD                  | None                               | Add GitHub Actions pipeline               | P0       |
| ✅ Done | `auth.module.ts`       | Default JWT secret                 | Fail fast if missing in production        | P1       |
| ✅ Done | `auth.service.ts`      | Session expires hardcoded 24h      | Use JWT_EXPIRES_IN                        | P2       |
| ❌ Open | `docker-compose.yaml`  | Commented out                      | Restore or remove                         | P2       |
| ❌ Open | `README.md`            | Stale feature list                 | Sync with implementation                  | P2       |
| ✅ Done | StatDash projections   | Box score vs replay inconsistency  | Unify on replay logic                     | P1       |
| ✅ Done | Queue workers          | Cache-only, no rebuild             | Call rebuildAndPersist or document        | P2       |
| ✅ Done | `execution_log.txt`    | In repo root                       | Review contents; add to .gitignore if log | P3       |
| ✅ Done | Test coverage          | Teams/tournaments/matches untested | Add service specs                         | P2       |
| ✅ Done | Health endpoint        | Missing                            | Add Terminus health module                | P2       |
| ✅ Done | Helmet                 | Not configured                     | Add to main.ts                            | P3       |

## Planned features (from existing docs)

From `README.md` future enhancements (some already done):

- [x] Match statistics tracking — StatDash + MatchStat
- [x] Shot chart data — StatDash projections
- [x] Real-time score updates — SSE
- [x] File upload — Cloudinary
- [ ] Tournament standings calculation
- [ ] Player performance analytics (beyond box score)
- [ ] Email notifications
- [x] API rate limiting
- [ ] Swagger/OpenAPI documentation

From `SYSTEM_DESIGN.md`:

- Caching strategy for deduplication (future)
- WebSocket alternative (SSE chosen instead)

## Dependencies to upgrade

Current versions from `package.json` (as of repo state):

| Package        | Version | Notes                                  |
| -------------- | ------- | -------------------------------------- |
| @nestjs/\*     | ^10.4.0 | NestJS 11 available — evaluate upgrade |
| @prisma/client | ^6.17.1 | Keep aligned with `prisma` CLI         |
| bullmq         | ^5.76.2 | Monitor breaking changes               |
| bcrypt         | ^6.0.0  | Major version — verify compatibility   |
| cloudinary     | ^2.9.0  | —                                      |
| typescript     | ^5.9.3  | —                                      |

No `npm audit` output captured in handover. Run `npm audit` on takeover.

## Verification status

`docs/statdash-be-verification-results.md` (2026-04-27):

- E2E-01 through E2E-05: **PASS**
- Session boot matrix: **PARTIAL** (DB connectivity noted)
- Lineup validation: **PARTIAL**

## Cross-references

- StatDash gaps: [07-statdash-realtime.md](./07-statdash-realtime.md)
- Security gaps: [09-security-and-auth.md](./09-security-and-auth.md)
