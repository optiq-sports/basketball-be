# **Backend Handoff: Outstanding Work**

Last updated 19 October 2026. Reviewed against backend `main` at `bc71efa` (merge PR #24, 14 Oct). Every
file and line reference below was re-read against that commit on 16 Oct, and the live readings were
re-taken the same day. On 18 Oct two items were re-checked live and found resolved (item 4 and the former
item 26), and the client delivery part was revised to match what the frontend has now built. On 19 Oct
broadcasting became its own role (item 25, rewritten), and the platform split was added (item 27).

This is the one file to work from. You do not need any other document to start. It lists only what is
still to be fixed: items 1 to 25, with 10a and 25a inserted, and item 27. Item 4 is resolved and kept only
as a pointer, so the numbering does not move under anyone. Items 20 to 25a are the client delivery work,
and item 27 is the platform split (part 6). Anything resolved has been taken out. The full history,
including everything already delivered, stays in `docs/BACKEND_GAPS.md`, and the Gap numbers here are that file's numbering, so
`Gap 47` here is `## Gap 47` there. Ask for that file if you want background on a single item. Nothing in
it is needed to act on this one. `docs/CLIENT_DELIVERY_ROADMAP.md`, mentioned in part 5, is the product
view of that work, and `docs/BROADCAST_ROLE_PLAN.md` and `docs/PLATFORM_SPLIT_PLAN.md` are our plans for
items 25 and 27. All three are available on request; none is needed to act on this file.

Two conventions, so nothing below looks like a missing attachment. "Fix 139" and "Bug 174" style numbers are entries in the frontend team's own changelog, included only to show where a claim came from; you do not need them. Every file path is in `basketball-be` unless it is prefixed `basketball-fe/`, which marks the few places we describe what our side does.

The part numbers start at 2 because part 1 was the two blockers, both resolved by the 14 Oct push and recorded as such below.

> On verification: the API is back up as of the 14 Oct push, and `GET /api/health` answers `200` with database and redis `up`. Items below were read from backend source. Those marked (unverified live) have not been re-exercised against the running server yet.
> 

How to reproduce anything in this file. Base URL `https://basketball-be-api.vercel.app/api`. Log in as `admin@gmail.com` / `123456` (ADMIN) or `stat1@gmail.com` / `123456` (STATISTICIAN). There is no working SUPER_ADMIN account, which is why the SUPER_ADMIN-only items are marked unverified. Note that every response is wrapped, so the token is at `data.access_token` and not at `access_token`:

```bash
API=https://basketball-be-api.vercel.app/api
TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@gmail.com","password":"123456"}' | jq -r .data.access_token)
curl -s "$API/ops/queues/health" -H "Authorization: Bearer $TOKEN" | jq .
```

Each item ends with a "Done when" line, which is the check that closes it. If one of those checks is wrong about what the product should do, we would rather hear that than have it implemented.

---

## **The previous handoff is fully delivered**

The 10 Oct push closed every item in the last version of this file. Recorded here so nobody repeats it:

| Was | Status |
| --- | --- |
| #53 Play-by-play timeline endpoint | Shipped: `GET /statdash/projections/match/:sessionId/timeline`. Incomplete, see item 18 |
| #54 Full box score stat set | Shipped: FG, 2PT, 3PT, FT, OREB/DREB, EFF. MIN and +/- still zero, see item 5 |
| #56 Team arena / founding year / contact email | Shipped, schema and DTOs |
| #57 Notifications | Shipped, model plus all four routes as specified |
| #58 Match stage and tournament format | Shipped, schema and DTOs |

Ten further gaps were closed in the same push without being asked for here: Gaps 24, 26, 30, 33, 40, 41, 43, 45, 48 and 51. That is a lot of ground, and it is appreciated.

---

---

## **The 14 Oct push closed both blockers**

`af67fc2` and `5f94919` resolved the two items that were blocking everything, plus one more:

| Was | Status |
| --- | --- |
| 1. The deployed API is completely down (Gap 53) | Fixed. Bull Board removed entirely: the `createBullBoard` block is gone from `bootstrap()` and all three `@bull-board/*` packages are gone from `package.json`. `packageManager: "pnpm@10.30.1"` added and `package-lock.json` deleted, which also settles the three-lockfiles note. Verified live: `/api/health` returns `200` with database and redis `up` |
| 2. The new schema has no migration (Gap 54) | Fixed. `20261014074000_add_advanced_stats_metadata_and_notifications` creates all of it: both password-reset columns with a unique index, the fifteen `match_stat` columns, team arena/founded/contact, `tournament.format`, `match.stage`, both enums, and the `notification` table with its indexes and cascade. Verified live: `GET /teams` returns the three team fields, and `POST /auth/forgot-password` returns `201` |
| 3. A tournament's public code works as a match key (Gap 52) | Fixed. The tournament-code branch is gone from `resolveMatchKey`. A tournament code is now looked up only to be refused, with `SD_SESSION_TOURNAMENT_CODE_NOT_SUPPORTED`. `SD_SESSION_MATCH_KEY_AMBIGUOUS` went with it |

That also closes Gap 46 end to end. The password-reset endpoints shipped on 10 Oct but could not run until these columns existed. The frontend flow is now built (Fix 139), including the `/reset-password` page that the emailed link points at. That was the whole critical path, so thank you.

Two things in the same commit turned out to be formatting only, so they are still open: `getTimeline()` (item 18) and the `plusMinus` / `secondsPlayed` calculation (item 5). Details are in place below.

---

## The 18 Oct checks closed two more

Both were marked as needing a live check. Both pass.

| Was | Status |
| --- | --- |
| 4. Accounts have no `Client` link (Gap 25) | Resolved. `admin@gmail.com` now has `clientIds: ["cmuv056p50000c9proo4a12nu"]` from `GET /auth/profile`, and `GET /tournaments` returns that client's one tournament rather than nothing |
| 26. The 409 version conflict drops its machine-readable fields (Gap 23) | Resolved. A command sent with a stale `expectedVersion` now answers `409` with `code: "SD_VERSION_CONFLICT"` and `latestVersion` in the body, beside the message. The rejected command wrote nothing. We will drop our parsing of the message text |

---

# **2. Security and correctness**

## **1. The login response omits `forcePasswordChange` and `clientIds` (Gap 50)**

`generateAuthResponse` (`auth/auth.service.ts:48`) returns `user: { id, email, name, role }`, in the object literal at `:90`. `GET /auth/profile` returns both of the missing fields. The frontend therefore cannot tell at login whether the account must change its password, and has to wait for a second request. Reading the absent flag as "no" showed a new client the whole portal for about 1.5 seconds before the change screen appeared (Fix 123).

Fix: include both fields in the login `user`, in the same shape as `/auth/profile`, and add them to `AuthResponseDto`. No extra query is needed. The login lookup at `:30` already runs `include: { profile: true, clientUsers: true }`, so `clientIds` is `user.clientUsers.map((c) => c.clientId)`, and `forcePasswordChange` is a column on `user`.

Done when: `POST /auth/login` and `GET /auth/profile` return the same `user` keys.

---

## **2. List endpoints pass unknown query params into the database (Gap 35)**

`tournaments.service.ts#findAll` destructures `...otherParams` at `:114` and spreads it into `where` at both `:128` and `:164`, and `buildPrismaPagination` passes `sortBy` straight into `orderBy`. `PaginationQueryDto` has `@IsIn(["asc","desc"])` on `sortOrder` but nothing on `sortBy`, so an unknown field returns a 400 carrying a database message.

Fix: `@IsIn([...])` on `sortBy` per DTO, and drop the catch-all spread at both call sites.

Done when: `GET /tournaments?sortBy=nonsense` returns a 400 naming the allowed values, with no database text in the body, and `GET /tournaments?somethingElse=1` is rejected rather than queried.

---

# **3. Data correctness**

## **3. A finished game's final score never reaches the match record (Gap 47), confirmed live**

Every completed game reads 0 to 0 wherever the app uses the match's own score. Verified earlier against match `cmubv9n890001jq04oekbag8w`: `GET /matches/:id` gave `homeScore: 0`, `awayScore: 0`, all quarter columns null and `stats: []`, while the projection for its session gave `score: { home: 34, away: 35 }` over 117 events. `GET /ops/queues/health` showed `statdash-matchstat-sync` with 33 failed jobs.

This hits the Results page, fixture cards, the dashboard's recent games and the client portal's match list. The match page's box score is correct, because it reads the projection.

`rebuildAndPersist()` is not the problem. It does write the score. Its transaction at `statdash/projections/statdash-projections.service.ts:255` updates `gameSession`, then runs `prisma.match.update({ data: { homeScore, awayScore } })` at `:268`, then the box-score `projectionState`, and then calls `syncMatchStatsFromBoxScore()` for the `matchStat` rows. Called directly through the rebuild endpoint it works, which is how the Sep 12 verification passed. The failure is in the queue layer that is supposed to call it. Diagnosis below.

Re-read live on 16 Oct 2026, unchanged from 15 Oct. `GET /ops/queues/health`:

```
statdash-projections    failed: 33   completed: 0   waiting: 0   active: 0
statdash-recompute      failed:  2   completed: 0   waiting: 0   active: 0
statdash-matchstat-sync failed: 41   completed: 0   waiting: 0   active: 0
```

`GET /ops/queues/lag` shows `waiting: 0, oldestWaitingMs: 0` on all three, so nothing is backlogged.

Seen again on 18 Oct, this time during a live game rather than after one. On match `cmv11x9s7000gjs04nzmsbx1u` (session `cmvdsfu3x0007l006phgl1etr`), `GET /matches/:id` read 66 to 70 while the session and the box score both read 66 to 73. So the match row lags during play as well, not only at the end, which fits the queue diagnosis below: the live score reaches the match row only through the same jobs. Our screens are unaffected because they take the session's score first, but anything reading the match row alone, including the external API's match list, shows a stale score mid-game.

### **Correction to the previous version of this file**

It said "zero completions, so the job has never once succeeded". That inference was wrong and should be ignored. All three queues are created with `defaultJobOptions: { attempts: 3, removeOnComplete: true }` (`common/queue/queue.service.ts:28`, `:32`, `:36`), and `getQueueHealth()` reports `getJobCounts()` (`:143`). A successful job is deleted the moment it finishes, so `completed` can only ever read `0`. The 76 failures are real, but the zero beside them means nothing. That was our misreading of your counts rather than anything in your code.

### **The failures cannot be coming from `rebuildAndPersist`**

All three handlers in `common/queue/queue-worker.service.ts` wrap the rebuild in `try { ... } catch { this.logger.error(...) }` and swallow it: `handleProjectionJob` (`:72`), `handleRecomputeJob` (`:90`), `handleMatchStatSyncJob` (`:108`). A caught error means the handler returns normally, so BullMQ marks the job completed and `removeOnComplete` deletes it. Two things follow.

First, a rebuild that throws is invisible. No failed job, no dead-letter row, no counter anywhere. This is the most important thing to change, independent of the rest of this item.

Second, the 76 failures must have come from the statements outside those try blocks, which is a short list:

- `handleProjectionJob` and `handleRecomputeJob`: `redisService.invalidateProjectionCache(sessionId)` and `invalidateSessionSnapshotCache(sessionId)`, both before the `try`.
- `handleMatchStatSyncJob`: `prisma.gameSession.findUnique({ where: { id: sessionId } })`, before the `try`.
- Or BullMQ itself, before the handler is entered: a stalled job whose lock expired, which after `maxStalledCount` is marked failed.

### **The stalled-lock case is worth checking first**

There is no separate worker process. `package.json` has only `start` and `start:prod`, both `node dist/main.js`, and `main.ts` ends at `app.listen(port)` (`:200`). The three `Worker`s are therefore constructed in `QueueWorkerService`'s constructor, inside the same process that serves HTTP. On a serverless host the instance is frozen once the response is sent, so a worker holding a job stops renewing its lock, the job stalls, is retried, and after three attempts is marked failed. That matches the shape we can see: failures accumulating with nothing waiting and nothing active. If the dead-letter reasons confirm it, the fix is infrastructural rather than a code change in the handler, because the worker needs its own long-lived process.

### **Fix, in this order**

1. Expose the dead-letter queue (item 10). Every failure already called `pushToDeadLetter({ ..., failedReason })` from the `worker.on("failed")` hook at `queue-worker.service.ts:62`, so the 76 reasons are already stored and simply cannot be read from outside. This one change turns the item from a hunt into a stack trace, which is why item 10 should be done first.
2. Stop swallowing. Re-throw after logging in all three handlers, so a failing rebuild fails its job and lands in the dead letter.
3. Keep a completed count. Use `removeOnComplete: { count: 100 }` or `{ age: 86_400 }` instead of `true`, so the health endpoint can show successes and this question is answerable from the Ops screen next time.
4. Then fix whatever the reasons name, and re-run the sync for every finished game.
5. Separately, the quarter columns are never written. The transaction at `:255` writes `match.homeScore` and `match.awayScore` and no `quarter1Home` through `quarter4Away`, which is why those read `null` even on a match whose total score has landed. `replay` already holds the per-quarter data.
6. Longer term, write the final and quarter scores on completion rather than only through the queue, and include `gameSessions` in the `GET /matches` list response so a list can show real scores without one extra request per row.

Done when: for a COMPLETED match, `GET /matches/:id` returns `homeScore` and `awayScore` equal to the box score at `GET /statdash/projections/:sessionId`, the four quarter pairs are non-null, and `stats[]` is not empty. Match `cmubv9n890001jq04oekbag8w` is the one to check, since it is the one we measured at 0 to 0 against a projection of 34 to 35 over 117 events.

---

## 4. Resolved on 18 Oct (Gap 25)

Kept as a pointer so the numbers below do not shift. See "The 18 Oct checks closed two more" above.

---

## **5. `plusMinus` and `secondsPlayed` are returned but never calculated (Gap 55)**

`ProjectionTotalsDto` and `PlayerProjectionDto` both declare them, and the service returns both, but neither is ever incremented. They are only set to `0` in `emptyPlayerProjection()`. The projection's event switch handles `shot`, `free_throw`, `rebound`, `foul` and `turnover` and nothing else. There is no `substitution` case, so time on court cannot be derived, and no `assist` case, so an assist on a made free throw is dropped, since assists arrive only through `payload.assistPlayerId` inside `shot`.

This is worse than omitting the fields, because zero is not the same as absent. The frontend hides a column when a field is missing, but these arrive as `0`, so MIN and plus/minus would render as a plausible-looking column of zeros for every player.

Fix: derive `secondsPlayed` from substitution events against the clock, accumulate `plusMinus` from scoring events against the on-court lineup, and add an `assist` case. Until that is done, please omit the two fields rather than sending `0`. The frontend currently treats a flat zero across every player as "not tracked".

Done when: in a game with substitutions, the box score's `secondsPlayed` values sum to roughly five players times the elapsed game clock, no starter reads `0`, and `plusMinus` across all ten players on court sums to zero. An assist on a made free throw is counted.

---

## **6. `GET /players?sortBy=createdAt` silently sorts by name (Gap 56)**

`players.service.ts:503`:

```tsx
if (sortBy && sortBy !== "createdAt") orderBy = { [sortBy]: sortOrder || "asc" };
else orderBy = [{ lastName: "asc" }, { firstName: "asc" }];
```

The one excluded value is `createdAt`, which is `PaginationQueryDto`'s own documented default. Asking for newest first returns alphabetical order, with a 200 and no indication that anything was ignored. Every other list endpoint honours it. A silent no-op is worse than a 400, because nobody notices it.

Fix: drop the `!== "createdAt"` exclusion. The branch is already correct for every other field. The frontend has removed the "Added" sort in the meantime.

Done when: `GET /players?sortBy=createdAt&sortOrder=desc` returns the most recently created player first, and we can put the "Added" sort back.

One aside: the two-term player search added in the same method is a real improvement, so please keep it.

---

## **7. Event time is not guaranteed on every event (Gap 29)**

`statdash-events.service.ts:285` stores `period` and `clockSecondsRemaining` only when the client sent them (`typeof command.payload.clockSecondsRemaining === "number" ? ... : null`), and stores `null` otherwise. Minutes played and plus/minus (item 5) both depend on every event carrying a time.

Fix: when a command omits them, fill from the session's current period and clock before storing. The pre-game jump ball then correctly gets Q1 10:00. The frontend stamps everything except that jump ball.

Done when: no row in `game_event` has a null `period` or `clock_seconds_remaining`, including the jump ball, which should read period 1 and a full clock.

---

## **8. Team and tournament `search` matches the name only (Gap 58)**

`TeamsService.findAll` passes `searchFields: ["name"]` to `buildPrismaPagination` (`teams.service.ts:62`), and `TournamentsService.findAll` does the same (`tournaments.service.ts:120`). A team's code, country and state, and a tournament's venue, are all returned and printed on their cards, but none of them is searchable, so typing a team code such as "LAL" into the teams search finds nothing.

This mattered less when the frontend held the whole list and filtered in the browser. Both pages are now server-paged, which they have to be to stay correct past one page, so the server's `search` is the only one in play.

What is needed: widen both arrays, to `["name", "code", "country", "state"]` for teams and `["name", "venue"]` for tournaments. `buildPrismaPagination` already turns more than one field into an `OR`, so nothing else changes. `PlayersService` does the same thing for first and last name.

Frontend status: worked around by being plain about it. The boxes say "Search team name" and "Search tournament name" so nobody types a code and concludes the record is missing. See Bug 174 and Bug 183.

Done when: `GET /teams?search=<a team's code>` returns that team, and `GET /tournaments?search=<a venue>` returns the tournaments held there.

---

## **9. Seeded dates of birth are epoch timestamps (Gap 38)**

`GET /players` returns values like `"1970-01-01T00:00:32.745Z"`, which is seconds fed into `new Date()` and read as milliseconds. Every seeded player was born on 1 January 1970.

Nothing in the API contract is wrong, so this is a seed fix. No screen shows an age, so nothing displays a wrong number today, but date of birth is one of the inputs to the duplicate check.

Done when: no player in `GET /players` has a `dateOfBirth` in 1970 unless they really were born then.

---

---

# **4. Missing capability**

## 10a. A match assigned to another statistician reports as a missing match key (Gap 65), new on 16 Oct

Added after a live report that every match key was failing. The keys were fine.

`statdash-sessions.controller.ts:75` passes `statisticianId` only when the caller is a STATISTICIAN,
and `resolveMatchKey` then narrows with
`AND: [{ OR: [{ statisticianId }, { statisticianId: null }] }]` (`statdash-sessions.service.ts:50`). A
match belonging to another statistician drops out of the `where`, reaches the `if (!match)` branch, and
comes back as `404 SD_SESSION_MATCH_NOT_FOUND`, "No match found for supplied matchKey".

Confirmed live on 16 Oct with match `cmv7sz6bc0001l206cwt2nx52`, which is assigned to
`buxu@gmail.com`. As `stat1@gmail.com` it is a 404. As `admin@gmail.com`, who is not narrowed, the same
key returns 200 with the session already IN_PROGRESS.

The scoping is reasonable. The message is not: it sends people hunting for a bad code or a broken
screen when the truth is an assignment. It cost us a debugging session to find and it will cost a
statistician a game.

Fix: look the match up without the narrowing first. If it exists but belongs to another statistician,
answer 403 with its own code, for example `SD_SESSION_MATCH_NOT_ASSIGNED`, and a message naming the
real problem. Keep the 404 for a key that matches nothing.

Worth deciding at the same time: whether an unassigned match should be openable by any statistician,
which `{ statisticianId: null }` allows today, and whether a statistician should be able to claim one.

One inconsistency to settle with it. `GET /matches` hard-filters a statistician to
`statisticianId = user.id` (`matches.controller.ts:92`, `matches.service.ts:144`), so an unassigned match
never appears in their list even though `resolveMatchKey` and `bootstrap` will both open it. Since
18 Oct the statistician's match-key screen lists their assigned matches and opens them without a key,
straight through `bootstrap` with the match id, so the list is now the way most statisticians will find
a game. If unassigned matches are meant to be open to anyone, they should be listed too; if they are not,
`bootstrap` and `resolveMatchKey` should stop accepting them.

Done when: a statistician resolving somebody else's match gets a 403 that says so, and a genuinely
unknown key still gets the 404.

---

## **10. The dead-letter queue is invisible, and ops actions can claim false success (Gap 44)**

`getQueueHealth` reports `statdash-projections`, `statdash-recompute` and `statdash-matchstat-sync`, and never `statdash-dlq`, so there is no count of what `POST /ops/queues/dead-letter/requeue` would move, which is what the Ops screen needs before it can show anything useful. With Redis off, `requeueDeadLetterJobs` returns `{ requeued: 0 }` and `warmSessionCaches` still returns `{ warmed: true }` after enqueueing nothing. `limit` has no upper bound, so `?limit=100000` is accepted, and `?limit=abc` is silently turned into 25 rather than rejected.

Fix: add the dead-letter counts to `health`; return `{ enabled: false }` or a 503, and `warmed: false`, from both actions when Redis is off; give `limit` a maximum and reject a non-number with a 400. Please also return each dead-letter job's `failedReason`, `queueName` and `data.sessionId` from `GET /ops/queues/dead-letter`. The count alone says how many broke; the reason says why, and that is what item 3 is waiting on.

Done when: `GET /ops/queues/health` includes a `statdash-dlq` entry, the dead-letter listing shows 76 rows with their failure reasons, `?limit=abc` is a 400 and `?limit=100000` is clamped or refused.

---

## **11. `DELETE /players/:id` does not delete a player, and nothing does (Gap 36)**

`PlayersService.remove()` sets active `playerTeam` rows to `isActive: false` with a `leftAt` date and returns 200. The `Player`, `matchStat` and `matchPlayer` rows all stay. The only path that really deletes is `POST /players/merge`, which removes the duplicate. So a misspelled name or a test entry can never be removed, and an admin who clicks "Delete" and gets a 200 reasonably believes it is gone.

We have taken the decision here, so this is no longer an either-or. Please do both halves:

1. Keep the current behaviour and rename the route to `POST /players/:id/release`. It does exactly what that name says, and the frontend has called it "Release" since Fix 95, with the button text saying the profile and stats stay. Keep `DELETE /players/:id` as an alias for one release so we can migrate, then drop it.
2. Add a real delete for the case the app has no answer for today, which is a misspelled name or a test entry. `DELETE /players/:id/permanent` hard-deletes only when the player has no `matchStat` and no `matchPlayer` rows, and answers 409 with a count when they do. Recorded stats must never be orphaned, so refusing is better than cascading.

Done when: releasing returns the player with `playerTeams[].isActive: false`, the permanent delete 404s on a second call for a player with no history, and 409s for one with stats.

---

## **12. Players cannot be filtered by position, or sorted by jersey number or team (Gap 37)**

`PlayerFilterDto` accepts only `teamId` and `unassigned`. The global pipe runs `forbidNonWhitelisted: true`, so `GET /players?position=CENTER` is a 400. `sortBy` goes straight to Prisma as a `player` column, so `jerseyNumber` and `teamName` are 400s too, because both live on the `playerTeam` join table.

With server-side paging these cannot be faked in the browser. Filtering the twelve rows on the current page would give the wrong answer for the other 103, so the controls are absent.

Fix: `position?: PlayerPosition` on the DTO, with `@IsOptional() @IsEnum(...)` and a `where` clause, plus an explicit `orderBy` branch over the related `playerTeams` record for jersey and team.

Done when: `GET /players?position=CENTER` returns only centres with a correct `itemCount`, and `sortBy=jerseyNumber` and `sortBy=teamName` both answer 200 in the right order.

---

## **13. A CLIENT user cannot read their own client's name (Gap 34)**

`GET /clients/me` does not exist. There is `GET /clients/me/api-keys`, but the only route returning client details is `GET /clients`, which is SUPER_ADMIN only. A client can see their keys and their matches but not their own organisation's name.

Fix: `GET /clients/me` returning `{ id, name, websiteUrl, logo }`, roles ADMIN and CLIENT, tenant-scoped in the same way as `/clients/me/api-keys`. The portal header shows the user's name instead for now.

Done when: a CLIENT account gets its own organisation from `GET /clients/me`, and a 403 or 404 for anyone else's.

---

## **14. Client users cannot be listed or unlinked, and clients cannot be searched (Gap 42, partly done)**

`PATCH /clients/:id` and `DELETE /clients/:id` now exist, which is appreciated. Still missing: `GET /clients/:id/users`, `DELETE /clients/:id/users/:userId`, and `search` on `GET /clients`, since `listClients` takes only `page` and `limit`. `POST /clients/:id/users` also links any user id without changing their role, so linking an ADMIN does nothing useful.

The Clients page searches the full list in the browser, and its "Give a user access" picker lists admins only, because nothing can search other users.

Done when: `GET /clients?search=` filters by name, `GET /clients/:id/users` lists the linked users, `DELETE /clients/:id/users/:userId` unlinks one, and linking a user either sets their role to CLIENT or refuses with a reason.

---

## **15. Welcome emails have no delivery confirmation and no recovery (Gap 49, partly done)**

The Ethereal fallback is gone and `EmailService` now reads `SMTP_HOST` directly, which is the right change. Two things remain. It warns when `SMTP_HOST` is unset rather than failing at startup, and `sendWelcomeEmail` still catches every error, returns `false`, and is neither awaited nor checked by `ClientsService.createClient` or `AdminService.create`. So the endpoint reports success whether or not mail went out, and a client whose email never arrived has no way in.

Fix: fail loudly at startup when SMTP is not configured, and return `emailSent: true | false` from `POST /clients`, and from `POST /admin` when the password was auto-generated. `POST /auth/forgot-password` now exists, which covers recovery.

Done when: `POST /clients` carries `emailSent`, and it reads `false` when SMTP is deliberately misconfigured rather than the call reporting plain success.

---

## **16. Audit log for privileged and destructive actions (Gap 32)**

There is no record of who deleted a tournament, changed a score, or granted access to a client.

Fix: an `AuditLog` table (`id, actorUserId, actorRole, clientId, action, entityType, entityId, before json, after json, createdAt`, indexed on `(clientId, createdAt)`), written in the same transaction as the change it records. Cover deletes of a tournament, match, team, player, statistician, admin or client; role and status changes; API key create and revoke; client user assignment; and match result changes. Plus `GET /audit-logs`, paginated and filterable by entity, action, actor and date range, where ADMIN sees its own client and SUPER_ADMIN sees everything.

Done when: deleting a tournament writes one row naming the actor, the entity and the before state, and `GET /audit-logs?entityType=tournament` returns it.

A note on priority: this is the largest item on the list, and if it competes with anything else here it should lose. Nothing in the app is broken without it. We simply cannot build the audit page.

---

## **17. Move access and refresh tokens into httpOnly cookies (Gap 31)**

Tokens are returned in the JSON body and stored in `localStorage`, where any injected script can read them.

Fix: set `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Lax; Path=/` on login and refresh, with the refresh cookie scoped to `/api/auth`. Have `JwtStrategy` read the cookie as well as the bearer header during rollout, then only the cookie. Set CORS `credentials: true` with an explicit origin list, since cookies do not work with `*`. Clear both on logout. The frontend switches to `credentials: 'include'` and drops `localStorage` once this ships.

Done when: login sets both cookies, an authenticated request succeeds with no `Authorization` header, and logout clears them. Please tell us before it becomes cookie-only, since the frontend has to switch to `credentials: 'include'` in the same window.

---

## 18. The play-by-play timeline omits the running score (Gap 57)

The endpoint exists, is tenant-scoped, applies reversals and caches for 60 seconds, all of which is
right. But `getTimeline()` returns only
`{ id, sequence, eventType, period, clockSecondsRemaining, payload }`.

Measured against the contract in the previous handoff, four things are missing.

`homeScore` and `awayScore`, the running score after each play.

`teamId` and `playerId` at the top level. They may be in `payload`, but the shape is not guaranteed per
event type, so the feed cannot reliably say who did what.

`description`, the action in words without the player's name, such as "offensive rebound" or "2nd of 2
free throws missed". The frontend prefixes the jersey number and name.

`period_end` and `game_end` rows, so the feed can show END OF PERIOD and END OF GAME.

Correction and change of priority, 18 Oct. The previous version of this item said the running score was
the one thing the frontend could not reconstruct, because of reversals, and that the lead tracker and
quarter scores could not be built without it. That was wrong. `resolveEvents()` already drops reversed
events and applies corrections before `getTimeline()` returns, and the box score is built from the same
resolved list, so a running sum over the timeline is exactly as reliable as the box score. The frontend
now does that sum, and fills `teamId`, `playerId` and a description from each payload (Fix 169). Quarter
scores, the play-by-play feed, the lead tracker and the scoring-run broadcast graphic all work today, and
reconcile with the session score on a 243-event game.

So this item is no longer blocking anything. It is still worth doing, for two reasons: one source of truth
is better than two that agree, and anything outside our frontend reading this endpoint, such as an
embed, would otherwise have to repeat our reconstruction. The `period_end` and `game_end` rows remain the
one thing we cannot derive cleanly. Whatever you send takes precedence: our reconstruction uses your
`homeScore`, `awayScore`, `teamId`, `playerId` and `description` wherever a row carries them, so this can
ship field by field with no coordination.

Fix: `resolveEvents()` already replays events in order, so the running score is available at each step.
Carry it through, and add the other three.

Done when: the last timeline row's `homeScore` and `awayScore` equal the match's final score, each row
carries `teamId`, `playerId` and a `description`, and the feed contains a `period_end` row per quarter.

---

## **19. No clock-running flag, so nothing downstream can tick a game clock (Gap 61), new on 16 Oct**

`GameSession` (`prisma/schema.prisma:274-276`) has `status`, `quarter` and `clockSecondsRemaining`, and nothing that says whether the clock is running. A search for `clockRunning`, `isClockRunning`, `clock_running` and `clockState` across the backend returns nothing.

Given only `clockSecondsRemaining: 437`, anything displaying a live clock has to either freeze between events, which looks broken, or count down regardless and drift wrong through every timeout, foul and dead ball. The statistician app knows the clock state locally. It is just never published.

Fix: two fields on `GameSession`, carried in the session snapshot and the SSE payload:

```
clockRunning   Boolean  @default(false) @map("clock_running")
clockUpdatedAt DateTime @updatedAt      @map("clock_updated_at")
```

A consumer then renders `clockRunning ? remaining - (now - clockUpdatedAt) : remaining` and stays correct without polling.

Scope note, revised 16 Oct after reading the broadcast overlay proposal. An earlier version of this file called this the one thing blocking live scoreboard graphics and asked for it to be pulled forward. That is no longer right. The product proposal puts the scorebug and the game clock explicitly out of scope for the first broadcast phase, because the first client already has a reliable scorebug through YoloBox. So this item is still real, still small, and still needed for any clock-bearing graphic later, but it does not block anything in part 5 and does not need pulling forward.

Done when: the session snapshot and the SSE `statdash-update` payload both carry `clockRunning` and `clockUpdatedAt`, the flag goes false on a timeout or dead ball, and true again when play resumes.

---

# 5. Client delivery

These six items are on the list, not parked. Every product decision they used to wait on has been taken,
and each decision is recorded in the item that depends on it, so nothing here needs a meeting before it
can start.

The plan they serve. Data reaches an audience three ways: clients pull our API into their own site, clients
paste ready-made embed snippets, and broadcasters run live overlays in streaming software. The overlay is
remotely controlled from a console rather than a static renderer, which is where most of this work comes
from. The wider product context is in `docs/CLIENT_DELIVERY_ROADMAP.md`.

Changed on 19 Oct: broadcasting is its own role. Earlier versions of this part had the client run the
broadcast console from their portal and asked whether the operator should reuse the `CLIENT` role. That is
now decided the other way. A new `BROADCASTER` role, created by admins and assigned to matches, runs the
console; clients keep their portal for matches, API keys and embeds. Item 25 is rewritten as that role.
Items 22 and 23 change only in who owns the overlay link and state: a broadcaster, per assigned match,
instead of a client. Item 27 gains the broadcast site. The build order below starts with item 25 now,
because the link and the state are both scoped to the broadcaster.

---

## The first broadcast client, and what phase one actually needs

There is now a product proposal for the first broadcast client, One Sport TV, and it narrows the first
phase considerably. Read it alongside this part. Two graphics only:

- Player Spotlight, a lower third showing one player's live stats for the current game, triggered by the
  operator and auto-dismissing after a few seconds.
- Team Comparison, a side-by-side of both teams' totals, triggered at halftime or a timeout and
  dismissed manually.

The scorebug and the game clock are explicitly out of scope for this phase, since the client already has
those through YoloBox. One output URL per game carries both graphics on one transparent page, pasted once
into OBS as a browser source. The operator's control panel has to work on a phone. Since 19 Oct the
operator is a BROADCASTER account (item 25), signed into the broadcast site.

Correction, 18 Oct 2026. An earlier version of this section told you phase one needed no new data
endpoints, on the grounds that the stat fields already existed. That was wrong and we are sorry for it.
The stat fields do exist. What does not exist is any way to attribute a number to a player or to a
team, and both graphics need that. We had checked the projection DTOs for the statistics and not for
the identity fields.

Concretely, through `/client/*` today: `PlayerProjectionDto` carries a `playerId` and no name, number
or photo; it carries no `teamId` either; `GET /client/matches/:matchId` includes the two team rows but
no roster, so there is nothing to join against; and `BoxScoreResponseDto.totals` is a single object
accumulated across both teams, not one per side. So a Player Spotlight has no name to show and a Team
Comparison has no two columns to fill. Gap 66 has the evidence and the smallest fix.

Our own screens are unaffected because the admin app joins the box score against the rosters that
`GET /matches/:id` returns. Client API consumers have no equivalent.

So the phase-one blockers are items 21, 22, 23 and 25 below, plus 25a only if the output page reads
statistics itself, which item 23 now recommends against. Two items on this list look
related and are not:

- Item 20, the missing list endpoints, because neither graphic needs teams, standings or leaders.
- Item 19, the clock flag, because the clock is out of scope for this phase.

Item 24, API key scopes, is now a maybe rather than a no. Neither graphic shows shot coordinates, so it
is still not needed for that, but if a player's photo goes into the Player Spotlight then the scopes
are the natural place to decide who may read it.

All three stay worth doing for the website and embed work, and for a scorebug later, but none of them
gates the first broadcast prototype.

Update, 18 Oct: the frontend has gone past the proposal's two graphics without adding to your list. The
control page in the client portal is built as a full broadcast console with nine graphics: the two
above, plus Score by quarter, Scoring run, Last play, Game leaders, Shooting by zone and Starting lineups,
and a scorebug that sits on its own switch beside whichever graphic is up. All of them are built from the match and
its projections. With the broadcaster role (item 25) admitted to exactly those reads for an assigned match,
none of them needs anything further from you beyond items 22 and 23, provided item 23 takes the shape
recommended at the end of this part. The scorebug carries no clock until item 19.
The client can of course leave the scorebug off and keep YoloBox's, as the proposal intends.

One assumption in the proposal is worth confirming before anyone builds against it. It says the output
URL goes into "OBS or YoloBox as a Browser Source". OBS browser sources handle a transparent background
properly. Whether the client's YoloBox model supports a web source at all, and whether it honours
transparency if it does, we have not verified, and if it does not then this client needs OBS somewhere in
the chain for these graphics to composite. Worth a five-minute check with the client's actual device
before the output page is designed around it.

Items 20 and 21 can start immediately. Item 21 in particular is a reliability defect in what already
ships, not a client feature, so please do not read it as future work.

---

## **20. The external client API has no teams, standings or league leaders (Gap 59)**

`src/client-api/client-api.controller.ts` exposes match-shaped data only: `matches`, `matches/:id`, `box-score`, `shot-chart` and the SSE `stream`. There is no way for a client to read a team, a roster, a table or a leader board.

The internal API already computes all three. `GET /tournaments/:id` embeds `teams[].team` with rosters, and the admin tournament page renders standings and leaders from existing endpoints. This is exposure and DTO filtering, not new computation.

Decision taken on versioning: external routes move to `/api/v1/client/*`. The design specified `v1`, the built routes are at `/api/client/*`, and there are no external integrators yet, so the five existing routes should move too and no aliases are needed. Doing it now avoids breaking embed and overlay URLs that are already in the field later on.

Fix: add these, tenant-scoped by the API key's client, with the same DTO filtering the existing client routes use.

- `GET /api/v1/client/teams` and `GET /api/v1/client/teams/:teamId`, the second with the roster
- `GET /api/v1/client/tournaments` and `GET /api/v1/client/tournaments/:tournamentId`
- `GET /api/v1/client/tournaments/:tournamentId/standings`
- `GET /api/v1/client/tournaments/:tournamentId/leaders`, taking `category` and `limit`

Done when: a client API key can read its own teams with rosters, a tournament's table and its leaders, and gets a 404 or 403 for another client's.

---

## 21. SSE has no heartbeat, and the stream cannot survive a long game (Gap 63)

`statdash/realtime/statdash-realtime.service.ts` sends nothing on an idle connection. There is no
`interval`, `heartbeat`, `keepalive` or ping anywhere in it. During a timeout there may be no event for
two minutes, and proxies, CDNs and load balancers close idle streams. StatDash survives this because an
operator is watching the screen and can refresh. An overlay on air cannot.

Fix: send an SSE comment frame (`: ping\n\n`) every 15 seconds or so on both
`statdash/realtime/sessions/:sessionId/stream` and `client/matches/:matchId/stream`.

Separately, please confirm the platform's real function-duration limit for a streaming response. The
deployment has no `vercel.json`, and the same serverless shape already broke the queue workers in item 3.
If the ceiling is minutes rather than hours, tell us and we will build the client to reconnect around it
rather than assuming a stream can last a whole game.

Our half of this is done: `basketball-fe/src/services/statdash/realtime.client.ts` now reconnects with
backoff after the browser gives up, and resumes with `sinceVersion` set to the highest version it has
seen (Fix 157). That covers a dropped connection. It does not cover a proxy silently holding an idle
connection open while delivering nothing, which only the heartbeat fixes.

Done when: an idle stream stays open for ten minutes with no events, and the duration ceiling is written
down.

---

## 22. No token type suits an embed or an overlay (Gap 64)

The only credential a client has is a full API key. It cannot go in a website embed or an overlay URL,
and there is nothing else to put there.

| Context | Can send headers? | Cookies? | Useful `Origin`? |
|---|---|---|---|
| Client dashboard | Yes | Yes | Yes, so the existing JWT is fine |
| Website embed | No, `EventSource` cannot | No, third-party and blocked | Yes |
| OBS or vMix overlay | No | No | No |

An embed can be defended by an origin check. An overlay cannot. That is why one token type will not do.

Worth knowing, since it settles an objection we raised and never resolved. We pushed back on the design's
`?apiKey=...` widget URL on the grounds that keys in URLs leak into logs, history and referrers. That was
right about the key and wrong as a general rule, because we already put the JWT in the query string
ourselves for StatDash's SSE (`basketball-fe/src/services/statdash/realtime.client.ts:26`), and
`auth/strategies/jwt.strategy.ts:9` reads it
back with the comment "SSE/EventSource cannot send Authorization headers". The answer is a narrower
token, not a different transport.

Decision taken: two new token types, both separate from the API key.

- `ClientEmbedToken`, public, read-only, with no advanced-stats scope and an allowed-origin list enforced
  server-side, revocable on its own.
- `BroadcastOverlayToken` (called `ClientOverlayToken` in earlier versions), unguessable, scoped to one
  match and one broadcaster, expiring in hours rather than months, revocable and reissuable. No origin check is possible here, so narrowness and expiry are the whole
  defence. Assume the URL will be pasted into a chat message to a camera operator.

This is the "Output URL" in the broadcast proposal, and it answers that document's second open question.
One token per assigned match per broadcaster, issued from the broadcaster's console (or by an admin of the
match's client), shown with a copy button, and not guessable from the match id. An expiry measured in hours covers a broadcast and
means a leaked URL stops working on its own. Please make reissue cheap, because an operator who has
already pasted the old URL into OBS will need to repaste, and that is better than a URL that works
forever.

Neither grants write access of any kind.

Done when: both types can be issued and revoked, an embed token is refused from an origin not on its
list, and an expired overlay token is refused.

### What the website widgets will read with an embed token, added 18 Oct

The embed builder is built in the client portal, with three widgets the client can design and preview on
their own data: a live scoreboard, a box score, and a tournament's schedule and results. The preview reads
with the client's own login. The published widget will read the same things with the embed token instead,
so this is the list the token has to open, read-only, for the token's own client:

- Scoreboard: one match with both teams' names, codes and colours, its status, date and venue, the live
  score, and the score by period. The score by period is the one piece not available outside our own
  login today: it needs either the quarter columns on the match (item 3) or the timeline with its running
  score (item 18).
- Box score: one match's players with names, shirt numbers and their side. That is item 25a, which the
  overlay no longer needs but this widget does.
- Schedule and results: a tournament's matches with teams, times, venues and scores. The scores are only
  right once the match record carries them during and after a game (item 3); until then the widget
  leaves a started game's score off rather than print 0 to 0.

The scoreboard also wants to update while a game is on. Accepting the embed token on the existing match
stream would cover it, with the item 21 heartbeat.

On our side, the code the client copies loads `embed.js` and a widget page that we will host and serve.
The client's colours come in as a snippet parameter until `GET /clients/me` carries branding (item 13).

---

## 23. No overlay scene state, and no control channel (Gap 62)

The client clicks "show the standings" in their dashboard and it appears on the stream a second later.
There is nowhere to store what they clicked, and no way to push it to the overlay.

The existing stream carries match data: score, clock, events. A controlled overlay needs a second answer
at all times, which is which graphic it should be showing and with which parameters. That is set by a
person in a dashboard rather than by the game, and nothing models it.

It has to persist, not only broadcast. An OBS browser source gets restarted mid-game as a matter of
routine, and it must come back showing exactly what was on air rather than blank.

Fix:

```
OverlayScene
  id, clientId, matchId
  activeScene     String    -- validated, see the scene list below
  payload         Json      -- the finished content of the graphic, written by the control page
  visible         Boolean   -- master on-air toggle, separate from the scene
  scorebugVisible Boolean   -- the scorebug has its own switch and sits beside any graphic
  autoDismissAt   DateTime? -- set when a scene dismisses itself, null when it does not
  updatedAt, updatedByUserId
```

`payload` replaces the `params` in the previous version of this item, and it is the recommendation at the
end of this part: the control page writes exactly what the graphic shows (names, numbers, colours), and
the output page renders the row without reading any statistics itself. The control page already holds all
of it, refreshes every eight seconds while a game is live, and will re-send the payload of whatever is on
air when its numbers change, so a comparison left up at a timeout stays current. Treat `payload` as opaque:
validate that it is an object under a sensible size, say 32 KB, and store it. Nothing on your side needs to
understand its contents.

One row per output. The broadcast proposal is explicit that the operator pastes a single URL into OBS and
both graphics appear on that one transparent layer, so a single row per game per client is the shape to
build. The schema allows more than one row, which is what a vMix operator wanting each graphic on its own
input would need later, but nothing in phase one requires it and the control panel should not offer it
yet.

`autoDismissAt` exists because lower thirds dismiss themselves after a few seconds; the operator now picks
5, 8 or 12. Please store the
timestamp rather than a duration, and let the output page hide the graphic once it passes. Storing a
duration instead would mean a browser source that reconnects two minutes later re-shows a graphic that
should have gone long ago, which is the sort of thing that only happens on air. When the scene auto
dismisses, the row can stay as it is: the timestamp in the past is the state.

- Console side, normal JWT, for a BROADCASTER on a match assigned to them, or an ADMIN or SUPER_ADMIN of the
  match's client: `GET /broadcast/matches/:matchId/overlay` for the current state, `PUT` the same path to
  replace it, and `POST /broadcast/matches/:matchId/overlay-link` to issue a link (which revokes the
  previous one) with `DELETE` to revoke. The row is keyed by match and broadcaster, so two outlets on one
  game each have their own state and their own link. `clientId` on the row is still worth storing, for
  tenancy and for the admin view.
- Overlay side, URL token from item 22: `GET /overlay/:token` for the current state, and
  `GET /overlay/:token/stream` to subscribe.

The output page is built against exactly this, so these details are the contract:

- `GET /overlay/:token` returns the row as `{ activeScene, visible, scorebugVisible, autoDismissAt,
  payload, updatedAt }`, wrapped in the usual `{ success, data }` envelope or not; the page accepts both.
- The stream sends the same JSON as an SSE event named `overlay` every time the row changes. An unnamed
  `message` event is accepted as well.
- `payload.v` is `1`. The page refuses any other value rather than guessing, which leaves room to change
  the shape later without an old browser source drawing nonsense.
- A `401`, `403` or `404` from `GET /overlay/:token` is read as an expired or revoked link, and the page
  stops trying, since no retry brings that back. Anything else, and any dropped stream, it retries with
  backoff, fetching the state again before resubscribing so nothing changed in the gap is missed.
- There is no need to multiplex match data into this stream, which an earlier version of this item asked
  for. With the finished content in `payload`, the overlay reads nothing else, and holds one connection.

Decision taken on the scene list, revised again on 18 Oct to match what is built: `blank`,
`player_spotlight`, `team_comparison`, `quarter_scores`, `scoring_run`, `last_play`, `game_leaders`,
`zone_shooting` and `starting_lineups`. The scorebug is not a scene, because it sits alongside one, which
is why it is the `scorebugVisible` column. Please keep `activeScene` a validated string rather than a
database enum, so the next graphic is a DTO change instead of a migration. That decision has now earned
its keep twice.

Selecting a new player replaces the current one rather than stacking, which one row per output gives you
for free.

One thing that does not affect you: whether the operator arms a graphic and then takes it to air, or a
click goes straight on air. Keeping `visible` separate from `activeScene` supports both, since the
dashboard can patch the two fields together or separately. It only decides what buttons we build.

Done when: a PATCH from the dashboard reaches a subscribed overlay in about a second, and a fresh
`GET /overlay/:token` after a restart returns the scene that was last set.

---

## **24. `ClientApiKey` has no scopes, so advanced stats reach nobody (Gap 60)**

The multi-tenancy design, section 4, specified that advanced properties such as shot coordinates and PER are stripped from external responses unless the API key carries an "Advanced Analytics" scope. What shipped is an unconditional strip. `client-api.service.ts:93` destructures `x` and `y` off every shot, and `streamMatch` does the same to each `deltaEvents` entry. There is no scope check because there is nothing to check: `ClientApiKey` (`prisma/schema.prisma:461`) has no `scopes` column.

The consequence is that a shot chart is impossible on any client site, embed or overlay, however entitled the client is. The blunt filter was the right thing to ship first. This is about making it grantable.

Decision taken: add the mechanism now. Who gets the scope is a commercial call that can be made per key later, and it does not need to be settled to build this.

Fix: `scopes String[] @default([])` on `ClientApiKey`, settable at creation by SUPER_ADMIN and returned on read, though never the secret itself. Make the strip in `client-api.service.ts` conditional on it. Our key screens are built and need one new field.

Done when: a key without the scope still gets no coordinates, and a key with it gets them.

---

## 25. A broadcaster role (rewritten 19 Oct)

Decided on 19 Oct: broadcasting is done by its own role, not by the client. This replaces the earlier
version of this item, which proposed reusing `CLIENT` and a per-client subdomain. Both are now settled the
other way. The plan and our side's tracker are in `docs/BROADCAST_ROLE_PLAN.md`.

It follows the statistician pattern you already have almost exactly, with one difference: assignment is
many to many.

1. The role. Add `BROADCASTER` to the `Role` enum, with a migration. `POST /auth/login` and
   `GET /auth/profile` return it as they return any role, and `forcePasswordChange` works the same way.
2. Accounts. Routes mirroring `/statistician` (list, get, create, update, deactivate), ADMIN and
   SUPER_ADMIN only, under `/broadcaster`. Create sends the same welcome email (item 15 applies) and sets
   the same forced first password change. A broadcaster is linked to the creating admin's client through
   `ClientUser`, so `getTenantFilter` scopes them like anyone else; a broadcaster covering two clients is
   linked to both.
3. Assignment. A join table, say `MatchBroadcaster { matchId, userId, assignedAt, assignedByUserId }`, unique
   on the pair, because one broadcaster covers many games and two outlets can cover one game. A route for
   an admin to set a match's broadcasters, for example `PUT /matches/:id/broadcasters` with a list of user
   ids, and the broadcasters listed on the admin's `GET /matches/:id`.
4. What a broadcaster can read: only the matches assigned to them. `GET /matches` filtered to those, as
   `matches.controller.ts:92` already filters a STATISTICIAN to `statisticianId`. `GET /matches/:id` for an
   assigned match, with the rosters as it returns today, and a 404 otherwise. The projections controller
   (`@Roles` at `statdash-projections.controller.ts:29`) admitting `Role.BROADCASTER`, with
   `checkSessionAccess` letting one through only when the session's match is assigned to them. The
   console reads exactly these, so nothing new is needed for reading.
5. What a broadcaster can write: their own overlay state and link for an assigned match (items 22 and 23),
   and nothing else. Every other route should refuse the role, which `RolesGuard` does by default for a
   role nobody lists, but please confirm the routes that have no `@Roles` and rely on `JwtAuthGuard`
   alone, since those would let a BROADCASTER in. `GET /teams` and `GET /players` were tightened that way
   on 10 Oct (Bug 150) and are the model.
6. Admins of the match's client can read and write a broadcaster's overlay for support.
7. One broadcast site for every broadcaster, for example `broadcast.optiqsports.com`. No per-broadcaster
   subdomain, so the wildcard DNS and certificate question from the original proposal goes away. Item 27
   covers its reset links and CORS.

Done when: an admin creates a broadcaster and assigns them to two matches; the broadcaster signs in, sees
those two in `GET /matches` and nothing else, reads their box scores and timelines, and gets a 404 or 403
for any other match, team, player or tournament route; the broadcaster can set and read their overlay
state and issue a link for an assigned match; and a CLIENT gets a 403 on all of the broadcast routes.

---

## **25a. The client API cannot say which player or which team a stat belongs to (Gap 66), new on 18 Oct**

This is the item that the correction above creates, and it is the one that decides whether either phase-one graphic can show anything at all.

Three holes, all in source as of 18 Oct 2026:

- `PlayerProjectionDto` carries `playerId` and the statistics, and no name, jersey number or photo.
- It carries no `teamId` either (`emptyPlayerProjection` sets none), and `GET /client/matches/:matchId` includes `homeTeam: true, awayTeam: true`, which is the team rows without their rosters. So there is nothing to join a player to a side with.
- `BoxScoreResponseDto.totals` is one object accumulated over both teams, so it is the combined game line rather than a per-team line.

Smallest change that unblocks phase one, in the order we would do it:

1. Add `teamId` to `PlayerProjectionDto`. The event payload already carries it and the service already reads it at `statdash-projections.service.ts:118`. This one field makes the box score splittable, and per-team totals become derivable by summing the rows, which gets Team Comparison working.
2. Put the roster on `GET /client/matches/:matchId`, as `homeTeam.players` and `awayTeam.players` with id, name and jersey number. Changing the Prisma include to pull `playerTeams` with the nested player covers it. Nothing else unblocks Player Spotlight, because a name cannot be derived.
3. Optionally expose per-team totals directly rather than leaving us to sum, which is tidier but not required.

On the player photo: it is the one field here that is personal rather than statistical, and the Spotlight looks much better with it. We would rather you decided whether it belongs in a public API than have us assume. Item 24's key scopes are the natural place to gate it if the answer is "sometimes".

Done when: a client API key can fetch one match and render a named player's stat line, and both teams' totals side by side, without any access to the admin endpoints.

---

## Answers to the five open questions in the broadcast proposal

The proposal asks the engineering team to advise on five things. Four of them are already settled by the
items above, so here they are in one place rather than being re-derived.

1. How should the control panel talk to the output URL in real time? Through the server, not between the
   two devices. The control panel PATCHes `OverlayScene` over its normal authenticated session, and the
   output page holds an SSE subscription to `GET /overlay/:token/stream` and re-renders when the state
   changes. That is item 23. Do not reach for WebSockets or any peer-to-peer channel: the state has to
   survive a browser-source restart anyway, so it has to live on the server, and once it does, a push
   over SSE is the cheap part. The proposal's two-second target is comfortable for SSE as long as item 21
   is done, which is why item 21 is a phase-one blocker rather than a nicety.
2. How should the output URL be generated and secured? `ClientOverlayToken`, item 22. One per game per
   broadcast client, unguessable, expiring in hours, reissuable from the game page.
3. How should the overlay animations work? This is frontend work and needs nothing from the backend
   beyond item 23. The output page animates on state change with CSS transitions, and the auto-dismiss is
   driven by the `autoDismissAt` timestamp in the scene row rather than by a timer the control panel
   holds, so a browser source that reconnects mid-graphic behaves correctly.
4. How does this fit the multi-tenancy model? Item 25: a `BROADCASTER` role, linked to a client like any
   user, seeing only the matches an admin assigns to it.
5. What is the build sequence? Below.

## Build sequence for the broadcast prototype

1. Item 25, the broadcaster role, accounts, assignment and read scoping. First now, because the link and
   the state are both scoped to the broadcaster, and because it is what the console signs in with.
2. Item 22, the overlay token, issued per broadcaster per match.
3. Item 23, the scene state and the control channel. The spine of the feature.
4. Item 21, the heartbeat. Before the first live test rather than after it, because the failure mode is a
   frozen graphic in front of an audience.

Item 25a drops off this path if item 23 stores the finished `payload` as recommended, because the output
page then reads no statistics. It stays on the list for anyone using the external API.

That is the whole backend critical path for phase one. The two graphics themselves, the control panel and
the output page are frontend work we can build in parallel once items 22 and 23 have a shape we can code
against.

The console is built, as a full broadcast console with nine graphics (see the update at the top of this
part). It was built in the client portal and moves to the broadcaster's own app once item 25 exists; its
reads are `GET /matches/:id` and the projections, which is why item 25 asks for exactly those to admit a
BROADCASTER on an assigned match. Nothing else is needed for reading.

That narrows what item 25a is for. The output page in OBS has no login, so whatever it reads has to come
through the overlay token from item 22. There are two ways to give it data, and the choice is yours
because it shapes item 23:

- The output reads statistics itself, through the token. Then whatever it reads must carry player
  names and per-team totals, which is item 25a.
- The control page writes the finished content of the graphic (names, numbers, colours) into the
  `OverlayScene` row when the operator takes it to air, and the output only renders what the row says.
  Then the output needs no statistics endpoint at all and item 25a stops being a phase-one blocker. The
  cost is that a graphic left up does not update by itself, which is fine for an eight-second spotlight
  and for a halftime comparison, when the numbers are not moving.

We recommend the second, and item 23 above is now written that way. Item 25a stays worth doing either way
for anyone using the external API.

What is left on our side is the output page itself: a transparent 1920 by 1080 page, its own small bundle,
rendering the same graphics from `GET /overlay/:token` and its stream. We will build it against the
shape in item 23, and it is now built (Fix 174), so connecting it is the only step left once your
endpoints exist.

---

# 6. Platform split

## 27. Four origins, and password-reset links by role (new, 18 Oct; broadcast site added 19 Oct)

The plan agreed on 18 Oct: StatDash becomes a desktop app, and the admin app, the client portal and the
broadcast site (item 25) are web apps on their own subdomains, for example `admin.`, `portal.` and
`broadcast.`. The frontend side is built (the
StatDash app as its own page, the desktop shell, and each web surface sending other roles to their own
site). Three small things are needed from you, and none blocks the others.

CORS. `resolveCorsOrigin()` in `main.ts` reads `CORS_ORIGINS` and allows everything when it is unset.
When it is set, it needs the admin, portal and broadcast addresses and the desktop app's origin, which is
`app://statdash`. The desktop app sends that as its `Origin` on every request, because it loads its pages
from a custom `app://` address rather than from disk. We ran it against the live API on 18 Oct and it
worked, so the deployed `CORS_ORIGINS` is either unset or already permissive; this is about not breaking
it when the list is tightened. Configuration, not code.

Password-reset links. `EmailService` builds every reset link from one variable, at
`notifications/email.service.ts:63`:
`${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=...`. With two subdomains, a
client's reset would open the admin site, or an admin's the portal. Please choose the base by the account's
role: a CLIENT to the portal's address, ADMIN and SUPER_ADMIN to the admin app's, a BROADCASTER to the
broadcast site's (item 25), and a STATISTICIAN to wherever the StatDash web fallback is served, since a
desktop app cannot open from an emailed link. Four variables, say `ADMIN_URL`, `PORTAL_URL`,
`BROADCAST_URL` and `STATDASH_URL`, with `FRONTEND_URL` kept as the fallback when
one is unset, so nothing changes until they are configured. Every surface already has the
`/reset-password` page. The welcome emails, if they carry a sign-in link, want the same treatment.

Item 17, tokens into httpOnly cookies, needs deciding with this plan in view before it is built. Cookies
set by the API are scoped to its own domain, so they are not sent from `admin.` or `portal.` unless the
cookie domain and `SameSite` settings are chosen for that, and a desktop app on `app://statdash` cannot use
them sensibly at all. Our recommendation: keep bearer tokens for the desktop app whatever is decided, and
if cookies go ahead for the web surfaces, accept both during and after the change rather than switching to
cookie-only.

Done when: the deployed `CORS_ORIGINS` names all four origins, a CLIENT's reset email links to the portal,
a BROADCASTER's to the broadcast site and an ADMIN's to the admin app, and item 17 has a written decision that covers the desktop app.

---

# Frontend-side, listed so nothing falls between us

Not your work. Recorded so the dependency is visible.

- Rebuild `/forgot-password` (Gap 46) is done (Fix 139), now that the 14 Oct migration landed the token
  columns. The `/reset-password` page the emailed link points at is built too.
- Statistician and admin search (Gap 39) stays in the browser on purpose, now that you have shipped the
  server side. `ApiClient.statistician.getAll` already walks every page, so the whole list is in hand,
  and filtering locally also matches a phone number and a location, which the server search does not.
  Nothing is owed here; it is recorded so the server-side support is not thought to be unused.
- `403 PASSWORD_CHANGE_REQUIRED` (Gap 27) is handled. An earlier version of this file said no screen
  collected a new password, which was out of date: `ChangePasswordRequired` is routed from
  `gateDecision.ts`, which sends an account with `forcePasswordChange` straight to it after login.
- A CLIENT experience in `AppGate` (Bug 83) is done: a CLIENT account lands in its own portal, with
  matches, match detail, API keys, account and website embeds.
- Reconnect and resume on the SSE client is done (Fix 157).
- The broadcast control console is done (Fixes 167, 172, 173). It was built in the client portal and
  moves to the broadcaster's own app on the broadcast site once item 25 exists; that move, the admin's
  Broadcasters page and the broadcaster picker on the match page are next on our side and wait on item 25.
  The output page is built too (Fix 174), as its own page, `overlay.html`, against the contract in item 23. Until your endpoints exist it runs in a
  preview window that follows the console in the same browser; the console already builds the exact state
  it will send you.
- The play-by-play timeline is completed on our side until item 18 ships (Fix 169).
- The platform split's frontend half is built: StatDash as its own page (`statdash.html`) packaged by an
  Electron shell, and the admin and portal surfaces each sending other roles to their own site (item 27,
  Fixes 178 to 180). The broadcast site joins them as a third web surface with item 25.
- Dropping our parsing of the 409 message text, now that `code` and `latestVersion` arrive (the former
  item 26), is done (Fix 175).

---

## Summary

27 open items: 1 to 25 with 10a and 25a inserted, less item 4, which is resolved, plus item 27, new on
18 Oct for the platform split. The former open question, item 26, is resolved too. None of them blocks a
feature from running.

The 14 Oct push cleared both blockers and the match-key hole, so nothing on this list now stops a feature
from running. What is left is correctness, missing capability, hardening, and the client delivery work in
part 5.

If you only do three things, do these, in this order.

1. Item 10, expose the dead-letter queue. Small, and it is the key to item 3, because the reasons those
   76 jobs failed are already stored and nothing can read them.
2. Item 3, the finished-game score. Re-diagnosed on 16 Oct: the rebuild itself is fine, the queue
   handlers swallow every error from it, and the failures are coming from the few statements outside
   their try blocks, or from stalled locks if the workers are running inside a serverless process. Full
   reasoning is in that item, including a correction to what the previous version of this file claimed.
3. Item 5, `plusMinus` and `secondsPlayed`. The migration made the zeros structural, so MIN and
   plus/minus now render as a plausible column of zeros rather than being hidden. Omitting the two fields
   is a one-line stopgap that is better than sending `0`.

There is a second track running alongside those three, and it does not compete with them for the same
thinking. The broadcast prototype needs items 25, 22, 23 and 21, in that order (item 25 is now the broadcaster
role, rewritten on 19 Oct), and the reasoning is at
the end of part 5. The control console is already built, so these four are now the whole distance between
the client and a working link to paste into OBS or vMix. If the broadcast client's first test has a date
attached, that track should lead.

Two items moved down on 18 Oct, both because of corrections on our side. Item 25a is needed for the
broadcast prototype only if the output page reads statistics itself, which item 23 now recommends against.
Item 18 no longer blocks the lead tracker or quarter scores, because the running score turned out to be
reconstructable from the resolved timeline after all.

One correction to the previous version of this summary: it asked for item 19, the clock flag, to be
pulled forward as the thing blocking live scoreboard graphics. The broadcast proposal puts the scorebug
and clock out of scope for the first phase, so that no longer holds. Item 19 is still worth doing and no
longer urgent. Item 21, the SSE heartbeat, has gone the other way: it is both a reliability defect in
what already ships and a phase-one blocker for the broadcast work.
