# Log: Studio skip question button

Date: 2026-05-25 12:29
Area: sbobby-web

## Summary

Added a skip control to the `/studio` study card so users can advance past a question without recording a correct or wrong review event.

## Files Changed

- `components/studio/ExamStudioApp.tsx`: added a local skip handler and a `Salta` button beside the answer toggle.

## Verification

- `npm run lint`: passed.
- `./node_modules/.bin/tsc --noEmit`: passed.
- `npm run build`: sandboxed run failed with the known Turbopack process/port permission error; escalated rerun passed.
- Browser check on `http://localhost:3000/studio`: reached the route, but the local browser session was unauthenticated and showed the login prompt, so the study card button was not visible for manual interaction.

## Notes

- Skipping resets the visible answer state and advances to the next loaded card only; it does not call `/api/review-events`.
