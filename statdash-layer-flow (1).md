# StatDash Layer Flow (Login -> Full StatDash)

## 1) Entry and Access Control

### Login (`/login`)
- User submits email/password in `src/pages/login/login.tsx`.
- `useLogin()` authenticates and returns user role.
- If role is `ROLE_STATISTICIAN`:
  - app attempts fullscreen via `enterFullscreenBestEffort()`
  - navigates to `/match-key`
- Non-statistician users are routed to `/dashboard`.

### Global Route Gate
- `src/routes.tsx` uses `AppGate`:
  - no token -> `/login`
  - profile load error -> clears auth state, routes to `/login`
  - statistician role -> mounts `StatisticianRoutes`
- `StatisticianRoutes` scope:
  - `/match-key`
  - `/starters`
  - `/choose-sides`
  - `/jump-ball`
  - `/stat-dash`

## 2) Pre-Game Statistician Wizard

### Step A: Match Key (`/match-key`)
- File: `src/pages/matchKey/MatchKey.tsx`
- Statistician enters match key.
- On continue:
  - stores `sessionStorage.statistician_match_key`
  - navigates to `/starters`
- Also shows recent completed games (read-only context).

### Step B: Starters (`/starters`)
- File: `src/pages/starters/Starters.tsx`
- Loads `StartersFlow` and validates before continue.
- Continue only proceeds when `attemptContinue()` passes.
- Next route: `/choose-sides`.

### Step C: Choose Shooting Sides (`/choose-sides`)
- File: `src/pages/choose/ChooseSides.tsx`
- User configures:
  - team left/right orientation (`homeOnLeft`)
  - attack direction (`homeAttacksLeft`) based on court type and swap state
- On continue:
  - persists orientation with `writeGameSetupOrientation(...)`
  - navigates to `/jump-ball`

### Step D: Jump Ball (`/jump-ball`)
- File: `src/pages/jump/JumpBall.tsx`
- User selects jump-ball winner (left/right).
- Winner is stored via `writeJumpBallWinner(...)`.
- Continue enabled after winner selection -> navigates to `/stat-dash`.

## 3) StatDash Initialization Layer (`/stat-dash`)

### Base Shell and State Setup
- Main file: `src/pages/statDash/StatDash.tsx`
- Initializes:
  - game clock, quarter, score
  - active lineups and bench
  - game log entries
  - event flow state machines:
    - `shotFlow`
    - `foulFlow`
    - `turnoverFlow`
- Reads side orientation from `readGameSetupOrientation()`.

### Start-Game Prompt (post jump-ball handoff)
- On load, if `readJumpBallWinner()` exists:
  - shows start-game CTA modal (`startGamePromptOpen`)
  - does **not** auto-start timer
- `Start game` -> starts timer
- `Not yet` -> closes CTA, timer remains stopped

## 4) StatDash UI Layers

### Top Controls Layer
- `MenuBar` for session controls
- `GameHeader` for:
  - scores
  - timer start/stop and adjustments
  - timeout, jump-ball, substitution actions

### Center Gameplay Layer (`GameCenter`)
- File: `src/pages/statDash/components/GameCenter.tsx`
- Structure:
  - left `PlayerPanel`
  - center court/overlay container
  - right `PlayerPanel`
- Court click modes:
  - left click -> missed-shot flow
  - right click -> made-shot flow
  - shift+left click -> foul-on-spot flow

### Overlay Priority
- Center view swaps from court to active recording panel:
  - shot panel
  - foul panel
  - turnover panel
  - timeout modal
  - jump-ball modal
  - foul picker modal
- Player-panel jersey interactions are gated by current flow step.

### Bottom Logging Layer
- `GameLog` shows latest events.
- Supports row editing via edit modal in `StatDash.tsx`.

## 5) Core Event Flows in StatDash

### Shot Flow
- Primary state machine in `shotFlow` (`idle` or active draft).
- Typical missed-shot path:
  1. Select shooter (miss)
  2. Select shot type
  3. Open full rebound decision modal
- Rebound decision supports:
  - offensive rebound made/miss follow-ups
  - defensive action (block involved)
  - dead-ball outcomes

### Block Branch (current behavior)
- From rebound decision, `block_involved`:
  1. opens `Select player (block)` first
  2. after block selection returns to rebound decision
  3. can repeat block path if selected again

### Foul Flow
- Handles:
  - fouler selection (player/bench/coach flow variants)
  - foul type
  - fouled player
  - FT count, assist, FT results
- Last missed FT now hands off to the **same full rebound decision modal** used by missed shot flow.

### Turnover Flow
- Handles:
  - committing player
  - turnover type
  - optional steal/no-steal branch

### Common Flow Controls
- `Back` and `Cancel` handling per active flow.
- `Escape` closes the highest-priority open modal/flow layer.

## 6) Data/Storage Touchpoints

- `localStorage`:
  - auth token/profile bootstrap
- `sessionStorage`:
  - `statistician_match_key`
- page-level persisted helpers:
  - orientation (`gameSetupOrientation`)
  - jump-ball winner handoff (`jumpBallWinner`)

## 7) Key Files (StatDash Layer Map)

- Routing and gate: `src/routes.tsx`
- Login entry: `src/pages/login/login.tsx`
- Wizard:
  - `src/pages/matchKey/MatchKey.tsx`
  - `src/pages/starters/Starters.tsx`
  - `src/pages/choose/ChooseSides.tsx`
  - `src/pages/jump/JumpBall.tsx`
- Main dashboard:
  - `src/pages/statDash/StatDash.tsx`
  - `src/pages/statDash/components/GameCenter.tsx`
  - `src/pages/statDash/components/ShotRecordingCourtPanel.tsx`
  - `src/pages/statDash/components/FoulRecordingCourtPanel.tsx`
  - `src/pages/statDash/components/TurnoverRecordingCourtPanel.tsx`
  - `src/pages/statDash/components/GameLog.tsx`
