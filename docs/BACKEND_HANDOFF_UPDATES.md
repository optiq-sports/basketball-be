# **Backend handoff: updates for the Notion page**

The backend team works from the 16 Oct handoff on Notion, plus the item 23 sent on 18 Oct. That version is `docs/BACKEND_HANDOFF.md`, unchanged. This file holds the changes made since, as blocks ready to paste, in the order they appear on the page. Each says exactly where it goes.

The broadcaster role, decided on 19 Oct, is in blocks 1, 7, 8, 10, 11, 12, 13, 14, 15 and 16. The rest are updates from 16 to 18 Oct that were never sent. To send only the broadcaster change, apply those ten; the others can follow whenever suits. Item 25a needs no change: what they have is current.

Once the page is updated, `docs/BACKEND_HANDOFF.md` should be brought in line with it.

---

## **1. The opening two paragraphs (19 Oct)**

Replace the two paragraphs from "Last updated 16 October 2026" to "...also available on request." with:

```markdown
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
```

---

## **2. The 18 Oct checks closed two more (18 Oct)**

Add as a new section after "The 14 Oct push closed both blockers", before part 2:

```markdown
## The 18 Oct checks closed two more

Both were marked as needing a live check. Both pass.

| Was | Status |
| --- | --- |
| 4. Accounts have no `Client` link (Gap 25) | Resolved. `admin@gmail.com` now has `clientIds: ["cmuv056p50000c9proo4a12nu"]` from `GET /auth/profile`, and `GET /tournaments` returns that client's one tournament rather than nothing |
| 26. The 409 version conflict drops its machine-readable fields (Gap 23) | Resolved. A command sent with a stale `expectedVersion` now answers `409` with `code: "SD_VERSION_CONFLICT"` and `latestVersion` in the body, beside the message. The rejected command wrote nothing. We will drop our parsing of the message text |
```

---

## **3. Item 3: a new paragraph (18 Oct)**

In item 3, add this paragraph just before the sub-heading "Correction to the previous version of this file":

```markdown
Seen again on 18 Oct, this time during a live game rather than after one. On match
`cmv11x9s7000gjs04nzmsbx1u` (session `cmvdsfu3x0007l006phgl1etr`), `GET /matches/:id` read 66 to 70 while
the session and the box score both read 66 to 73. So the match row lags during play as well, not only
at the end, which fits the queue diagnosis below: the live score reaches the match row only through the
same jobs. Our screens are unaffected because they take the session's score first, but anything reading
the match row alone, including the external API's match list, shows a stale score mid-game.
```

---

## **4. Item 4: resolved (18 Oct)**

Replace the whole of item 4 ("Accounts have no Client link...") with:

```markdown
## 4. Resolved on 18 Oct (Gap 25)

Kept as a pointer so the numbers below do not shift. See "The 18 Oct checks closed two more" above.
```

---

## **5. Item 10a: new (16 Oct)**

Add as a new item at the start of part 4, before item 10:

```markdown
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
```

---

## **6. Item 18: corrected (18 Oct)**

Replace the whole of item 18 with:

```markdown
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
```

---

## **7. Part 5 introduction (19 Oct)**

Replace everything from the heading "5. Client delivery" down to item 20 (the three introductory paragraphs) with:

```markdown
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
```

---

## **8. The first broadcast client (18 Oct, amended 19 Oct)**

Add as a new section right after the part 5 introduction, before item 20:

```markdown
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
```

---

## **9. Item 21: our half is done (18 Oct)**

Replace the whole of item 21 with:

```markdown
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
```

---

## **10. Item 22: overlay token per broadcaster, and what embeds read (18 Oct, amended 19 Oct)**

Replace the whole of item 22 with:

```markdown
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
```

---

## **11. Item 23: owned by the broadcaster (19 Oct)**

Replace the whole of item 23 (the version you sent on 18 Oct) with:

```markdown
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
```

---

## **12. Item 25: the broadcaster role (19 Oct)**

Delete the heading "6. Open question, not a defect" and the whole of the old item 25 ("Broadcast clients have no account model..."). Add this in its place, straight after item 24, still in part 5:

```markdown
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
```

---

## **13. Answers to the proposal, and the build sequence (18 Oct, amended 19 Oct)**

Add these two sections after item 25a:

```markdown
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
```

---

## **14. Part 6: the platform split, item 27 (18 Oct, amended 19 Oct)**

Add as a new part after the build sequence, before "Frontend-side, listed so nothing falls between us":

```markdown
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
```

---

## **15. Frontend-side list (19 Oct)**

Replace the whole list under "Frontend-side, listed so nothing falls between us" with:

```markdown
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
```

---

## **16. Summary (19 Oct)**

Replace the whole Summary with:

```markdown
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
```
