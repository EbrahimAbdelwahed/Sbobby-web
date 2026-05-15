# Log: question viewer, sidebar, progress

Date: 2026-05-15 16:30
Area: sbobby-web

## Summary

Implemented an incremental UX pass for search/mistakes detail viewing, compact navigation, smoother search requests, and real progress bars in the Revisioni tab. No dependencies were added.

## Files Changed

- `components/questions/QuestionDetailDialog.tsx`: added a reusable read-only Radix dialog that lazily fetches full published question details from `/api/questions?question=<id>&limit=1`.
- `components/search/SearchPageClient.tsx`: changed result action to `Apri dettaglio`, wired the local detail dialog, kept Studio as a secondary dialog link, and added an in-session response cache keyed by search params.
- `components/app/AppShell.tsx`: added persisted sidebar collapsed state and shell data attribute for layout width.
- `components/app/Sidebar.tsx`: added desktop collapse/expand control, accessible icon-only collapsed links, and mobile icon-only labels through CSS.
- `components/studio/ExamStudioApp.tsx`: added real progress rows in `Revisioni` using topic totals, unique reviewed counts, unseen counts, and attempt breakdowns.
- `lib/exam/repository.ts`: extended `getTopicStats` with total published questions, unique reviewed questions, and unseen counts per topic using the existing published-card SQL gate.
- `app/globals.css`: added styles for collapsed/mobile sidebar, question detail dialog, source/detail blocks, and topic progress bars.
- Primary review follow-up: adjusted sidebar `localStorage` hydration to read after mount, translated evidence labels in the detail viewer, and changed progress bars to semantic `role="progressbar"`.

## Verification

- `npm run lint`: passed.
- Primary review rerun `npm run lint`: passed after the hydration follow-up.
- `npm run build`: failed in sandbox with Turbopack `Operation not permitted` while binding a local port for `app/globals.css`; escalated rerun passed.
- Primary review rerun `npm run build`: same sandbox Turbopack port-bind failure, escalated rerun passed.
- `npm run dev`: sandbox failed with `listen EPERM 0.0.0.0:3000`; escalated dev server started but exited with Next persistence directory error `invalid digit found in string`.
- `npm start`: started production server from the successful build.
- `curl -s -L -o /dev/null -w '%{http_code} %{url_effective}\n' http://localhost:3000/search`: `200 http://localhost:3000/search/`.
- `curl -s -L -o /dev/null -w '%{http_code} %{url_effective}\n' http://localhost:3000/mistakes`: `200 http://localhost:3000/mistakes/`.
- `curl -s -L -o /dev/null -w '%{http_code} %{url_effective}\n' http://localhost:3000/studio`: `200 http://localhost:3000/studio/`.
- `curl -s -L -o /dev/null -w '%{http_code} %{url_effective}\n' http://localhost:3000/admin/review`: `200 http://localhost:3000/admin/review/`.
- Browser smoke on the production server loaded `/search`, `/mistakes`, `/studio`, and `/admin/review` and found the Sbobby shell/page content.

## Notes

- The modal fetch preserves existing auth and publication gating through `/api/questions`.
- The progress bars are simple CSS bars over real counts; no chart library or fake trend data was introduced.
- Manual authenticated click-through of actual search result detail was limited by session availability in the smoke environment.
