# 16 — Handover Checklist

[← Glossary](./15-glossary-and-conventions.md) | [Index](./README.md)

Use this checklist during the transition between outgoing and incoming teams.

---

## Outgoing team must provide

### Access

- [ ] GitHub repo access (read/write/admin as needed)
- [ ] Deploy platform access (hosting dashboard)
- [ ] Production database access (read-only minimum for incoming team)
- [ ] Staging database access
- [ ] Cloudinary account access (or API key rotation handoff)
- [ ] Redis instance access (if used in prod)
- [ ] Postman workspace / shared collection (if used)

### Documentation and inventory

- [ ] Environment variable inventory per environment (dev, staging, prod)
- [ ] Production API base URL(s)
- [ ] Staging API base URL(s)
- [ ] Frontend application URL(s) and repo link
- [ ] Production logs / monitoring dashboard URLs
- [ ] Database hosting provider and connection pooling setup

### People and process

- [ ] On-call / support contacts (see placeholders in [13-runbooks.md](./13-runbooks.md))
- [ ] Escalation path for production incidents
- [ ] List of pending PRs and in-flight work
- [ ] Scheduled maintenance windows or cron jobs (if any outside repo)
- [ ] Answer to: How is first `SUPER_ADMIN` provisioned?

### Credentials rotation handoff

- [ ] Confirm seed credentials (`test@basketball.com`) are **not** used in production
- [ ] Document last JWT_SECRET rotation date
- [ ] Document database backup schedule and restore procedure

---

## Incoming team should complete

### Week 1 — Environment

- [ ] Clone repo and read [README.md](./README.md) (index) and [01-executive-summary.md](./01-executive-summary.md)
- [ ] Local setup verified per [03-getting-started.md](./03-getting-started.md)
- [ ] PostgreSQL running; migrations applied
- [ ] `.env` configured from `.env.example`
- [ ] `npm run dev` starts without errors
- [ ] Seed admin login works
- [ ] Redis tested (with and without `REDIS_URL`)

### Week 1 — Quality gates

- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes (or document environment blockers)
- [ ] Import and exercise Postman collection
- [ ] Review [14-known-issues-and-roadmap.md](./14-known-issues-and-roadmap.md)

### Week 1 — Domain understanding

- [ ] Trace auth flow: login → JWT → protected endpoint ([06-core-domains.md](./06-core-domains.md#auth))
- [ ] Create tournament → team → player → match flow end-to-end
- [ ] Trace StatDash flow: bootstrap → start → command → SSE ([07-statdash-realtime.md](./07-statdash-realtime.md))
- [ ] Understand data model ([05-data-model.md](./05-data-model.md))

### Week 2 — Operations

- [ ] Can deploy to staging `[UNKNOWN until outgoing team provides access]`
- [ ] Can run `prisma migrate deploy` on staging safely
- [ ] Queue health endpoint tested (if Redis enabled)
- [ ] Review security gaps ([09-security-and-auth.md](./09-security-and-auth.md))
- [ ] Decide on fixes for P0 items (open upload, open register)

### Knowledge transfer sessions (recommended)

| Session | Topics | Docs |
|---------|--------|------|
| 1 | Architecture, auth, CRUD domains | 02, 04, 06, 09 |
| 2 | StatDash deep dive + frontend integration | 07, GUIDE.md |
| 3 | Ops, deploy, incidents | 10, 12, 13 |
| 4 | Testing, tech debt, roadmap | 11, 14 |

### Questions log

Incoming team should log questions and track answers:

| # | Question | Answer | Answered by | Date |
|---|----------|--------|-------------|------|
| 1 | Production URL? | | | |
| 2 | CI/CD pipeline? | | | |
| 3 | First SUPER_ADMIN creation? | | | |
| 4 | Is Redis required in prod? | | | |
| 5 | Frontend repo URL? | | | |
| 6 | | | | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Outgoing tech lead | | | |
| Incoming tech lead | | | |
| Product owner | | | |

---

## Quick reference after handover

| Need | Document |
|------|----------|
| Start locally | [03-getting-started.md](./03-getting-started.md) |
| API endpoints | [04-api-reference.md](./04-api-reference.md) |
| Live stats | [07-statdash-realtime.md](./07-statdash-realtime.md) |
| Production incident | [13-runbooks.md](./13-runbooks.md) |
| What's broken / debt | [14-known-issues-and-roadmap.md](./14-known-issues-and-roadmap.md) |
