# StatDash Backend Architecture (Initial Scaffold)

This backend introduces a dedicated `statdash` domain that is isolated from existing CRUD modules and will evolve as an event-sourced game session engine.

## Module boundaries

- `statdash/sessions`: session lifecycle (resolve, bootstrap, start, state resume)
- `statdash/events`: command validation, transactional event append, rule handlers
- `statdash/projections`: read models for box score, summaries, and per-player views
- `statdash/realtime`: session-scoped updates through websocket/SSE channels
- `statdash/contracts`: single source of truth for event enums, payload contracts, and canonical game-state types

## Reliability model (target)

- Append-only event log with optimistic concurrency by session version
- Idempotency keys to make retried commands safe
- Canonical session snapshot updated atomically with event writes
- Projections rebuilt deterministically from event history

## Integration constraints

- Existing modules and CRUD routes remain intact
- Cross-module interactions happen through explicit services/contracts
- New StatDash endpoints will be namespaced under `/statdash/*`
