# Log: Simulation reset and shared session 400

Date: 2026-05-10 16:55
Area: sbobby-web

## Summary

Added a personal simulation reset action and fixed the shared-session answer submission failure.

The shared-session 400 came from saving a personal `review_events.session_id` with a shared session id. That column references `study_sessions`, not `shared_study_sessions`, so the review-event insert violated the foreign key after the shared answer was submitted. Shared progress now stays in `shared_study_answers`, while personal stats are still recorded as review events without a personal session id.

## Files Changed

- `lib/exam/repository.ts`: records review events from shared answers with `sessionId: null`.
- `components/study/SharedStudyApp.tsx`: surfaces answer-save failures instead of silently blocking progress.
- `components/studio/ExamStudioApp.tsx`: adds `Reset simulazione`, which starts a fresh personal session, reloads questions for current filters, and preserves prior review events.
- `app/api/study-sessions/route.ts`: accepts full study filters, including topic arrays, limit, and order.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed outside sandbox. The first sandboxed build failed with the known Turbopack internal bind/port permission error.
- `curl http://localhost:3000/studio`: returned `308` redirect while dev server was running.
- `curl http://localhost:3000/api/status`: returned `308` redirect while dev server was running.

## Notes

- Reset intentionally does not delete `review_events`, so progress and completed questions remain available for stats/history.
