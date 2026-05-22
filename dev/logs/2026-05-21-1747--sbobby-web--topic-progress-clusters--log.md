# Log: Topic progress and clusters

Date: 2026-05-21 17:47
Area: sbobby-web

## Summary

Implemented stats refinements for per-topic done/wrong/not-done bars and added largest taxonomy cluster stats for modules/topic branches.

## Files Changed

- `lib/exam/types.ts`: added topic progress and topic cluster stat interfaces.
- `lib/exam/repository.ts`: typed topic stats, adjusted topic ordering, and added largest module/topic branch cluster aggregation over active published questions.
- `app/api/stats/topics/route.ts`: returns both `topics` and `clusters`.
- `components/studio/ExamStudioApp.tsx`: renders stacked progress bars and a largest clusters section with total/reviewed/wrong/not-done counts.
- `app/globals.css`: added minimal scoped progress-bar segment styles.

## Verification

- `npm run lint`: passed.
- `./node_modules/.bin/tsc --noEmit`: passed.
- `npm run build`: passed outside sandbox. Earlier worker attempts were blocked by a concurrent build, and the later sandboxed build failed with the known Turbopack process/port `Operation not permitted` error.
- `npm run verify:smoke`: passed outside sandbox against `next start`. The sandboxed smoke command failed first because local `localhost:3000` connections were denied with `EPERM`.
- Browser check: general app smoke passed; authenticated stats UI could not be exercised from the browser in this session.

## Notes

- Cluster question counts use `COUNT(DISTINCT q.id)` and the existing published-question filter, so unpublished/admin-only cards are excluded.
- Wrong counts intentionally include `wrong` and `partial` review attempts.
