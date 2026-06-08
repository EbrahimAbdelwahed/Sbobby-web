# Plan: Simulation reset and shared session 400

Date: 2026-05-10 16:40
Area: sbobby-web

## Goal

Add a reset action for personal simulations that keeps saved progress, and fix shared study sessions so answering later questions does not fail with HTTP 400.

## Scope

- In scope:
  - Add a visible reset/restart button in the study UI.
  - Preserve `review_events` history and current per-question progress.
  - Start a fresh personal study session on reset when possible.
  - Fix shared answer submission by avoiding the invalid `review_events.session_id` foreign key.
  - Verify with lint/build and targeted API or browser checks where possible.
- Out of scope:
  - Redesign the shared-session synchronization model.
  - Delete or rewrite historical user progress.

## Approach

1. Update shared answer persistence so `shared_study_answers` remains the source of shared-session progress, while personal stats are recorded as regular review events without a personal `study_sessions.id`.
2. Add a `resetSimulation` UI action to reset the current index/answer state, fetch a fresh question set for the current filters, and create a new personal study session.
3. Improve user-facing messages around reset/start failures.
4. Record a completion log and push the relevant code changes.

## Risks

- If the user expects reset to erase history, this implementation intentionally does not do that; it preserves attempts as requested.
- Existing shared answers that previously succeeded before the failed review-event insert remain valid and are idempotently overwritten by later submissions.

## Verification

- `npm run lint`
- `npm run build`
- Targeted browser/API check for shared answer submission if a logged-in local session is available.
