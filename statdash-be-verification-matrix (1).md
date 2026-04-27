# StatDash Backend Verification Matrix

Use this matrix to validate your existing backend against current `StatDash` frontend behavior.

## How to Use
- Fill `Endpoint(s)` with your real BE routes.
- Mark `Status` as `PASS`, `PARTIAL`, `FAIL`, or `N/A`.
- Use `Evidence` for request/response IDs, DB rows, or test-run references.

## Legend
- `PASS`: behavior fully matches FE expectation
- `PARTIAL`: works but with gaps
- `FAIL`: mismatch or broken behavior
- `N/A`: not applicable in your implementation

---

## 1) Session and Game Boot

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| BOOT-01 | Match key resolves to active game/session |  |  |  |
| BOOT-02 | Game bootstrap returns score/quarter/clock and required context |  |  |  |
| BOOT-03 | Jump-ball winner handoff persists and can be consumed at StatDash entry |  |  |  |
| BOOT-04 | Explicit start-game action starts clock (no forced auto-start) |  |  |  |
| BOOT-05 | Re-open game restores latest authoritative state |  |  |  |

## 2) Contract and Enum Alignment

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| API-01 | Action names align with FE (`shot`,`assist`,`rebound`,`block`,`foul`,`turnover`,`steal`,`dead ball`) |  |  |  |
| API-02 | Result values align with FE branches (made/missed/dead-ball reasons) |  |  |  |
| API-03 | Required fields are enforced per event type |  |  |  |
| API-04 | Optional fields are handled safely when omitted |  |  |  |
| API-05 | Validation errors are deterministic and actionable |  |  |  |

## 3) Missed Shot and Rebound Decisions

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| SHOT-01 | Missed shot persists before rebound branch selection |  |  |  |
| SHOT-02 | Rebound decision accepts offensive miss/made branches |  |  |  |
| SHOT-03 | Dead-ball outcomes (`out_of_bounds`,`shot_clock_violation`) end sequence correctly |  |  |  |
| SHOT-04 | Event order returned by BE matches FE log order |  |  |  |
| SHOT-05 | Idempotency/retry does not duplicate shot/rebound records |  |  |  |

## 4) Offensive Rebound Follow-Ups

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| ORB-01 | Offensive rebound (miss) -> shooter(miss) -> rebound modal repeats correctly |  |  |  |
| ORB-02 | Offensive rebound (made) -> shooter(made) ends flow and finalizes score/log |  |  |  |
| ORB-03 | Tip-in layup/dunk mapping is correct in persistence layer |  |  |  |
| ORB-04 | Score updates on made only |  |  |  |

## 5) Block-Involved Loop (Critical)

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| BLK-01 | `block_involved` transitions to blocker selection first |  |  |  |
| BLK-02 | Blocker must be defensive side only |  |  |  |
| BLK-03 | After block, flow re-enters rebound decision state |  |  |  |
| BLK-04 | Repeating `block_involved` continues loop without state corruption |  |  |  |
| BLK-05 | Back/cancel or retries do not produce invalid partial chains |  |  |  |

## 6) Foul and FT Sequence (Critical)

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| FOUL-01 | Foul sequence validates fouler, type, fouled player |  |  |  |
| FOUL-02 | FT count and FT result order are enforced |  |  |  |
| FOUL-03 | FT makes affect score exactly once |  |  |  |
| FOUL-04 | Last FT made completes without rebound branch |  |  |  |
| FOUL-05 | Last FT missed transitions to full rebound decision flow |  |  |  |
| FOUL-06 | Foul + FT + rebound linkage is reportable/auditable |  |  |  |

## 7) Turnover and Steal

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| TOV-01 | Turnover type rules align with FE options |  |  |  |
| TOV-02 | Steal required/optional behavior is correctly enforced |  |  |  |
| TOV-03 | Stealer must be opponent side |  |  |  |
| TOV-04 | Turnover + steal order is consistent in log output |  |  |  |

## 8) Lineup and Jersey Validation

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| LUP-01 | On-court event actors must be on-court |  |  |  |
| LUP-02 | Bench/coach foul roles are accepted only where allowed |  |  |  |
| LUP-03 | Substitutions update active lineup before later validations |  |  |  |
| LUP-04 | Invalid cross-team jersey picks are rejected |  |  |  |

## 9) Edit/Reconciliation

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| EDIT-01 | Editing log entries recalculates dependent state safely |  |  |  |
| EDIT-02 | Delete/reverse behavior is explicit and consistent |  |  |  |
| EDIT-03 | Historical ordering remains stable after edits |  |  |  |
| EDIT-04 | Audit fields retained (`createdBy`,`updatedBy`,`timestamps`) |  |  |  |

## 10) Reliability and Concurrency

| ID | Verification Item | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| REL-01 | Multi-step writes are transactional |  |  |  |
| REL-02 | Idempotency key (or equivalent) exists for retries |  |  |  |
| REL-03 | Concurrency/version protection prevents race corruption |  |  |  |
| REL-04 | API returns canonical latest game version after writes |  |  |  |
| REL-05 | Recovery path for partial failures is verified |  |  |  |

---

## High-Priority End-to-End Scenarios

| Scenario ID | Scenario | Endpoint(s) | Status | Evidence / Notes |
|---|---|---|---|---|
| E2E-01 | Missed shot -> block involved -> blocker -> rebound decision -> block involved repeat |  |  |  |
| E2E-02 | Missed shot -> offensive rebound made -> shooter(made) -> score + log finalize |  |  |  |
| E2E-03 | Missed shot -> offensive rebound miss -> shooter(miss) -> rebound decision repeat |  |  |  |
| E2E-04 | Foul -> FT sequence -> last FT miss -> full rebound decision modal branches |  |  |  |
| E2E-05 | Dead-ball exits from both shot and FT-miss rebound paths |  |  |  |

---

## Optional Sign-Off

| Role | Name | Date | Sign-Off |
|---|---|---|---|
| Backend Lead |  |  |  |
| QA Lead |  |  |  |
| Product/Statistician Owner |  |  |  |
