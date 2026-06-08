# Plan: Mobile study finish session

Date: 2026-05-21 17:30
Area: sbobby-web

## Goal

Add a `/mobile-study` action to terminate the current simulation and save its state.

## Scope

- In scope:
  - Add a visible finish button in the mobile quiz flow.
  - Persist a session snapshot for manual and natural completion.
  - Preserve existing answer review-event saving.
- Out of scope:
  - Desktop study flow changes.
  - Session resume UI.
  - Deleting or rewriting historical progress.

## Approach

1. Extend personal `study_sessions` with additive completion/state fields.
2. Add a PATCH route to save the current mobile session snapshot for the authenticated user.
3. Wire `/mobile-study` to save before showing the completion summary.
4. Verify with lint/build where possible.

## Risks

- Existing DB rows have no completion state; fields must remain nullable.
- Review events already save per answer, so the session snapshot should complement rather than replace them.

## Verification

- `npm run lint`
- `npm run build`
