# Log: admin review auto-close reports

Date: 2026-05-16 11:19
Area: sbobby-web

## Summary

Admin review now closes open reports when a reviewed card reaches a final publication decision. Publishing a card marks its open/reviewing reports as `resolved`; rejecting or marking it not recoverable marks them as `dismissed`.

## Files Changed

- `lib/exam/repository.ts`: calls the existing report-status updater from `updateQuestionReview` after final publication status changes.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed outside the sandbox.

## Notes

- Plain `Salva` keeps reports open so the card remains visible until the admin publishes, rejects, or marks it not recoverable.
