# Platform Decisions & Infrastructure Specifications

Last updated: October 2026

This document records the architectural decisions, hosting limits, and environment configuration rules established for the Optiq Sports Basketball platform.

---

## 1. Streaming Time Limits and SSE Heartbeat (Item 21)

### Host Execution Limits (Vercel Serverless)
- **Host:** Vercel Serverless Function (`basketball-be-api.vercel.app`)
- **Default Function Timeout:** 15 seconds (Hobby), up to 300 seconds (5 minutes) on Pro plan, or 900 seconds (15 minutes) with Fluid Compute.
- **Can a single SSE HTTP response stream last a whole game?**
  - **No.** On serverless hosting architectures (like Vercel), long-lived HTTP responses are terminated once the function execution timeout is reached. A single HTTP connection cannot stay open continuously for the full duration of a 2-hour game.
  - **Client Reconnection Strategy:** Real-time consumers (`StatDash`, `OBS/vMix` overlay sources, and client API consumers) use standard SSE (`EventSource`) with:
    - Automatic reconnection built into the browser/client upon disconnection.
    - `sinceVersion` or `lastEventId` query parameters to replay missed state during reconnection.
    - Periodic comment heartbeats (`: ping` or `{ comment: 'ping' }`) sent every 15 seconds to prevent intermediate proxy/firewall idle connection drops.
  - **Dedicated Long-Running Hosting:** If persistent non-reconnecting SSE connections are strictly required across full multi-hour games without client reconnections, the streaming endpoints must be hosted on a persistent container or VM environment (e.g., Railway, AWS ECS, Fly.io, or DigitalOcean) rather than serverless functions.

---

## 2. Platform Split & Origins (Item 27)

### Environment URL Configuration
The platform frontend consists of multiple specialized applications corresponding to user roles:

| Variable | Target Application | Example Production URL |
| --- | --- | --- |
| `PORTAL_URL` | Client Team/Tournament Portal | `https://portal.optiqsports.com` |
| `ADMIN_URL` | Administrative Dashboard | `https://admin.optiqsports.com` |
| `BROADCAST_URL` | Broadcaster Console & Overlays | `https://broadcast.optiqsports.com` |
| `STATDASH_URL` | StatDash Court-side App | `https://statdash.optiqsports.com` |

### CORS Origin Resolution
In `src/main.ts`:
- If `CORS_ORIGINS` is configured as an explicit comma-separated list of origins, the backend automatically extracts and includes the origins configured in `PORTAL_URL`, `ADMIN_URL`, `BROADCAST_URL`, and `STATDASH_URL`.
- The desktop application origin `app://statdash` is unconditionally allowed.
- Password reset emails dynamically construct their redirect URLs based on the user's role to direct the user to their designated application portal.

### Authentication: Cookies vs. Bearer Tokens Decision
- **Desktop Application:** The desktop application (`app://statdash`) cannot use browser cookie storage and depends on explicit HTTP headers (`Authorization: Bearer <token>`).
- **Web Applications:** All endpoints support standard `Authorization: Bearer <token>` authentication.
- **Decision:** Bearer tokens remain the primary authentication mechanism across the platform. While optional `httpOnly` secure cookies may be supported in future releases for web browser frontends to mitigate XSS exposure, Bearer token support will remain permanently active to guarantee compatibility with native/desktop clients, API integrations, and OBS overlay sources.

---

## 3. Background Queue Workers & Database Connection Pooling (Item 3)

### Serverless vs. Dedicated Worker Process
- **Problem:** When queue workers run inside serverless web functions, the hosting provider freezes or terminates function instances between incoming HTTP requests. This caused BullMQ jobs (`statdash-projections`, `statdash-matchstat-sync`, `statdash-recompute`) to stall and trigger dead-letter queue exhaustion.
- **Solution:**
  - Queue workers are disabled inside serverless web processes (`VERCEL=1`) unless explicitly enabled via `ENABLE_QUEUE_WORKERS=true`.
  - Queue workers run in an isolated, long-running Node process:
    ```bash
    bun run start:worker
    # or
    npm run start:worker
    ```
- **Connection Pool Limit Management:**
  - Database connection pool limit is capped (e.g. 5 connections on pooled databases like Neon PgBouncer).
  - Worker concurrency across all queues is capped at `QUEUE_CONCURRENCY=2` (default) to ensure worker processes and HTTP web processes never starve the shared connection pool.
- **Historical Match Quarter Scores:**
  - Game completion and projection rebuilding sync quarter scores (`quarter1Home`, `quarter1Away`, `quarter2Home`, `quarter2Away`, `quarter3Home`, `quarter3Away`, `quarter4Home`, `quarter4Away`) and final scores to the `Match` table.
  - To sync any completed games that missed quarter scores, run:
    ```bash
    bun run sync:scores
    # or
    npm run sync:scores
    ```
