# Plan: mobile study first visit popup

Date: 2026-05-21 08:58
Area: sbobby-web

## Goal

Add a one-time popup on the home/dashboard that explains the new mobile study web app, how to add it to the phone home screen, how to use it, and why it is useful. The popup must appear when the home/dashboard is actually visited after the feature was added, and only once per browser.

## Scope

- In scope:
  - Detect a real home/dashboard visit client-side.
  - Show a one-time informational popup from the normal app shell on the home/dashboard.
  - Persist dismissal in `localStorage`.
  - Keep `/mobile-study` as a plain, focused shell without the main sidebar.
  - Add minimal, accessible UI and scoped CSS.
  - Record a dev log and verification outcomes.
- Out of scope:
  - Backend persistence of announcement state.
  - Push notifications, install prompt APIs, service worker work, or PWA manifest changes.
  - Changes to MCQ study logic, auth, reports, or study-session APIs.

## Approach

1. Add a small client component for the announcement popup, preferably in `components/app/`, using existing Radix Dialog dependency or the repo's dialog patterns.
2. In `AppShell`, define versioned localStorage keys:
   - dismissed key: records that the announcement has been closed.
3. On route changes:
   - If pathname is `/mobile-study` or below it, do not render the popup.
   - If pathname is `/` or `/studio` and dismissed is not set, open the popup once.
4. Popup content should be concise and useful:
   - "Studio mobile disponibile"
   - Open `/mobile-study`
   - Add to home screen from the browser share/menu.
   - Use it for focused MCQ sessions with subject/topic/count, skip, explanation, report.
   - Benefit: less UI noise, fast phone sessions, same backend data.
5. Add CSS to `app/globals.css` matching Sbobby's calm neutral UI. Ensure mobile sizing works and text does not overflow.
6. Add a log under `dev/logs/` with files changed and exact verification.

## Risks

- LocalStorage logic can be annoying if it shows on every route; gate strictly to the home/dashboard route.
- Because `/mobile-study` is in `plainShellRoutes`, any popup rendered only in the normal shell will not interrupt the mobile study flow.
- A versioned storage key is useful if future copy changes need to resurface the announcement intentionally.

## Verification

- `npm run lint`
- `npm run build`
- Manual/browser check if practical:
  - Load `/studio` with cleared relevant localStorage keys: popup visible.
  - Visit `/mobile-study`: popup hidden there.
  - Close popup: dismissed key set and popup no longer appears on refresh/navigation.
