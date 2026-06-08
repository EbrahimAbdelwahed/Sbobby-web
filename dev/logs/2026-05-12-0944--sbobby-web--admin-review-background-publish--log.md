# Log: admin review background publish

Date: 2026-05-12 09:44
Area: sbobby-web

## Summary

Updated the admin review UI so manual review actions no longer reload the full queue after every save. Admin actions now submit in the background, keep progress local, optimistically remove published/rejected cards from the visible queue, and restore the card if the API request fails.

## Files Changed

- `components/studio/ExamStudioApp.tsx`: added per-card saving state, optimistic local queue updates, no full `loadAdmin()` after each review mutation, and error rollback.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed after rerunning outside the sandbox because Turbopack could not bind to a local process port inside the sandbox.

## Notes

- Manual review is still available through `/admin/review`; final-state cards should disappear from the active queue without blocking the next card.
