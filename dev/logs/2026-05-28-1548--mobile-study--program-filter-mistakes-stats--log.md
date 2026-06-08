# Log: mobile-study program filter, mistakes mode, subject stats

Date: 2026-05-28 15:48
Area: mobile-study

## Summary

Implemented a mobile-study checkpoint for three issues: mobile-study now requests only current-program eligible questions, setup can prioritize questions last answered wrong/partial before filling with unseen questions, and the progress panel shows per-subject totals, seen, missing, and last-wrong counts.

## Files Changed

- `app/api/questions/route.ts`: added `requireProgramEligible` query parsing and `last_wrong_first` ordering.
- `app/api/study-sessions/route.ts`: accepts `last_wrong_first` in saved session filters.
- `app/api/stats/topics/route.ts`: includes subject-level progress stats.
- `app/globals.css`: styles the mobile-study mistakes-first checkbox.
- `components/mobile-study/MobileStudyApp.tsx`: sends mobile-only program eligibility, adds mistakes-first setup control, and renders subject stats.
- `lib/exam/repository.ts`: adds forced program eligibility, last-wrong-first ordering, and subject stats query.
- `lib/exam/types.ts`: adds the new order and subject stats type.

## Verification

- `npm run lint`: passed.
- `npm run build`: sandbox build failed on Turbopack port binding; escalated build passed.

## Notes

- This prevents mobile-study from serving cards already marked `program_eligible=false`, including explicit manual/random topic sessions.
- It does not automatically remove cards that are still incorrectly marked `program_eligible=true`; those require the DeepSeek review/repair path to update database eligibility.
