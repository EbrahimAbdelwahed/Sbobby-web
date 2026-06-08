# Plan: Shared session join entry

Date: 2026-05-21 17:45
Area: sbobby-web

## Goal

Make joining a shared study session discoverable from the web app outside the `/studio` sidebar.

## Scope

- In scope:
  - Add a compact join page or component, preferably `/study/shared/join`.
  - Call existing `POST /api/shared-sessions` with `{ code }`.
  - Normalize code to uppercase and trim whitespace.
  - Redirect to `/study/shared/<CODE>` on success.
  - Show inline errors for missing/invalid/not-found code.
  - Add a visible navigation entry from the app shell or dashboard if it fits existing navigation.
- Out of scope:
  - Changing shared-session backend contracts.
  - Replacing existing `/studio` join flow.
  - Group review redesign.

## Approach

1. Inspect existing shared routes and `components/study/SharedStudyApp.tsx`.
2. Add a small client component for join form state and submit behavior.
3. Add `app/study/shared/join/page.tsx` using normal app shell styling.
4. Reuse existing `sb-*` classes where possible.
5. Add a nav entry or lightweight link where users naturally look for shared sessions.
6. Add a focused dev log after implementation.

## Risks

- `/study/shared/[code]` catches dynamic paths; ensure `/study/shared/join` resolves to the explicit join page.
- Auth redirects may depend on backend 401 behavior; handle it cleanly client-side.

## Verification

- `npm run lint`
- `npm run build`
- Manual/browser smoke: empty code, invalid code, successful redirect if a valid code is available.
