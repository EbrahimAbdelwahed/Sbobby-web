# Plan: Mobile study prioritized sessions, shared entry, and clusters

Date: 2026-05-22 18:25
Area: sbobby-web

## Goal

Improve `/mobile-study` so it can enter shared sessions, build personal sessions with unseen questions first, and expose the existing topic/cluster progress view in the mobile web app.

## Scope

- In scope:
  - Add a compact shared-session join entry to the mobile setup.
  - Change random personal question selection to prioritize never-reviewed questions before previously seen ones.
  - Preserve existing random behavior inside each priority bucket.
  - Reuse existing `/api/stats/topics` data for mobile topic progress and largest clusters.
  - Keep desktop stats and shared-session flows working.
- Out of scope:
  - Changing shared-session run UI.
  - Adding spaced-repetition scheduling.
  - Changing review-event semantics.
  - Importing new cluster data sources.

## Approach

1. Add a repository order mode for unseen-first random sampling and expose it through question/session filter types and API parsing.
2. Update `/mobile-study` session creation and question fetch to request unseen-first ordering.
3. Add a small shared-session code form/link in the mobile setup that reuses `POST /api/shared-sessions`.
4. Fetch `/api/stats/topics` during mobile bootstrap and render compact topic progress and largest-cluster panels below setup.
5. Add mobile-scoped CSS only.
6. Record a dev log with exact verification outcomes.

## Risks

- `wrong` is an attempt count while reviewed/unseen are unique question counts; labels must keep that distinction clear.
- Unseen-first prioritization may still include seen questions when the selected filters have fewer unseen questions than the requested limit.
- Authenticated browser verification may be limited by the local session state.

## Verification

- `npm run lint`
- `./node_modules/.bin/tsc --noEmit`
- `npm run build` if practical in the sandbox; otherwise document the known Turbopack sandbox limitation.
