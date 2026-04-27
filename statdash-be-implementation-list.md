# StatDash Backend Implementation List

1. **Create a dedicated StatDash backend domain**  
   Add a real game-session and event system in backend (not just `matches` CRUD), so StatDash actions are saved as authoritative basketball events.

2. **Define one shared FE/BE event contract**  
   Freeze exact enums/strings and payload shapes for shot, rebound, block, foul, FT, turnover, steal, dead-ball so frontend and backend never drift.

3. **Implement session boot and resume endpoints**  
   Support match-key resolution, jump-ball handoff, explicit start-game trigger, and full game-state bootstrap (score, quarter, clock, possession context, lineups, recent events).

4. **Add a transactional event write API**  
   Build command-style endpoints that save event + update score/state + return canonical latest game version in one atomic operation.

5. **Implement missed-shot and rebound core flow exactly as FE behaves**  
   Ensure missed shot is recorded first, then rebound decisions (offensive miss/make, block involved, dead-ball exits) follow with correct ordering.

6. **Implement offensive rebound follow-up loops**  
   Support repeat loop for offensive rebound miss, clean finish for offensive rebound made, and correct tip-in layup/dunk mapping.

7. **Implement block-involved critical loop**  
   Make `block_involved` immediately require blocker selection, enforce defensive-side blocker only, then return to rebound decision safely (including repeated loops).

8. **Implement foul + free-throw sequence rules**  
   Enforce FT count/order strictly, increment score only on FT makes, route last FT made to close flow, and last FT missed into full rebound decision flow.

9. **Implement turnover + steal validation rules**  
   Enforce turnover type rules, required/optional steal behavior by turnover type, and opponent-only stealer validation with correct log order.

10. **Enforce lineup and jersey validity at command time**  
    Validate that players are on court for on-court actions, allow bench/coach fouls only where permitted, and reject invalid cross-team jersey selections.

11. **Add safe edit/replay correction mechanics**  
    Support event correction/reversal with auditability and deterministic recalculation of dependent state (score and derived stats) without corrupting history.

12. **Add reliability protections**  
    Introduce idempotency keys, optimistic concurrency/version checks, and partial-failure recovery behavior so retries and concurrent writes are safe.

13. **Build derived stats projections from event source**  
    Generate reliable player stats, team stats, and game stats from recorded statistician events so all reporting is consistent with game logs.


