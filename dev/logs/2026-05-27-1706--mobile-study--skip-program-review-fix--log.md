# Log: mobile-study skip program review fix

Date: 2026-05-27 17:06
Area: mobile-study

## Summary

Verified production skip reports are now being created after deploy, but many automatic reviews were failing with `could not determine data type of parameter $4`. Fixed the SQL update that applies DeepSeek out-of-program decisions by casting the admin-note parameter to text.

Kept the behavior aligned with product direction: skipped questions are not hidden merely because the user skipped them. They leave the pool only when DeepSeek classifies them as out of program. Lowered the out-of-program application threshold from `0.85` to `0.8` because production logs showed clear `out_of_program` decisions at `0.8` remaining in the pool.

## Files Changed

- `lib/exam/repository.ts`: fixed SQL parameter typing in `applyMobileSkipProgramReview` and lowered the DeepSeek out-of-program apply threshold to `0.8`.

## Verification

- `npm run lint`: passed.
- `npm run build`: sandbox run previously hit the known Turbopack port-binding issue; escalated rerun passed.

## Notes

- Existing failed production reports will not automatically rerun just from this code change. They need a retry/review pass after deployment if we want to clean up already-skipped cards.
- No user-specific skip exclusion was kept; removal remains based on DeepSeek review only.
