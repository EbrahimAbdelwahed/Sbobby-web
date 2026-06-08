# Log: mobile study first visit popup

Date: 2026-05-21 09:00
Area: sbobby-web

## Summary

Added a one-time Radix Dialog announcement for the mobile study web app. The shell shows it on the home/dashboard when the announcement has not been dismissed, never renders it on the plain `/mobile-study` route, and stores dismissal in a versioned localStorage key. Dismissing the dialog or opening the mobile study CTA sets the versioned dismissed key.

## Files Changed

- `components/app/AppShell.tsx`: added route-aware dismissal persistence and popup rendering on the home/dashboard only.
- `components/app/MobileStudyAnnouncement.tsx`: added the accessible client dialog with concise Italian setup/use/benefit copy and CTA to `/mobile-study`.
- `app/globals.css`: added scoped responsive popup styles using existing Sbobby dialog/button visual language.
- `dev/logs/2026-05-21-0900--sbobby-web--mobile-study-first-visit-popup--log.md`: recorded implementation and verification.

## Verification

- `npm run lint`: passed.
- `npm run build`: failed in the default sandbox due to the recurring Turbopack limitation: `creating new process`, `binding to a port`, `Operation not permitted (os error 1)` while processing `app/globals.css`; passed when rerun outside the sandbox.
- Static logic check: confirmed `/mobile-study` and nested paths return plain children before popup rendering; `/studio` shows the popup when `sb-mobile-study-announcement-v1-dismissed` is not true; close/escape/overlay/secondary action and primary CTA persist dismissal.
- Browser check: started the production server, but unauthenticated navigation to `/studio` lands on `/login`, so the authenticated home popup state could not be fully exercised in-browser in this session.

## Notes

- Primary agent will commit and push the verified UI change per `sbobby-web` repo rules.
