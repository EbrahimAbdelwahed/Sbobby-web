# Log: mobile study entry link

Date: 2026-05-21 00:00
Area: sbobby-web

## Summary

Added visible navigation entries to open the mobile study web app from the existing Sbobby UI.

## Files Changed

- `components/app/Sidebar.tsx`: added a `/mobile-study` navigation item with a phone icon.
- `components/SiteNav.tsx`: added a `/mobile-study` link for screens that use the simple top nav.

## Verification

- `npm run lint`: passed.
- `npm run build`: failed in sandbox with Turbopack `Operation not permitted` while processing `app/globals.css`; passed when rerun outside the sandbox.

## Notes

- The `/mobile-study` route remains in the plain shell list, so opening it still shows the dedicated minimal mobile interface.
