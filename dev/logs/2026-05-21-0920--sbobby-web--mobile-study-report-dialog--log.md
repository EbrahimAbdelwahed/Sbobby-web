# Log: mobile study report dialog

Date: 2026-05-21 09:20
Area: sbobby-web

## Summary

Replaced the `/mobile-study` report popup's inline absolute panel with a Radix Dialog sheet. The report flow still posts to `/api/questions/${questionId}/reports`, preserves the selected reason and note state, resets the note after successful submission, and shows an inline result message.

## Files Changed

- `components/mobile-study/MobileStudyApp.tsx`: replaced the lateral report panel with a controlled Radix Dialog using the existing overlay and compact mobile-first form layout.
- `app/globals.css`: removed the absolute report panel styling and added scoped report dialog, body, header, footer, title, description, and responsive bottom-sheet styles.

## Verification

- `npm run lint`: passed.
- `git diff --check -- components/mobile-study/MobileStudyApp.tsx app/globals.css dev/logs/2026-05-21-0920--sbobby-web--mobile-study-report-dialog--log.md`: passed.
- `npm run build`: failed in sandbox with Turbopack `Operation not permitted` while processing `app/globals.css`; passed when rerun outside the sandbox.
- `./node_modules/.bin/next dev --webpack --port 3001`: started successfully for local route verification after `next dev` with Turbopack failed on a local persistence directory error.
- Browser check on `http://localhost:3001/mobile-study`: route rendered and then showed the expected unauthenticated "Accesso richiesto" state. At mobile viewport width, loaded CSS for `.sb-mobile-study-report-dialog` contains the bottom-sheet rule `left: 0`, `bottom: 0`, `width: 100vw`, `max-height: 94svh`, and `transform: none`.

## Notes

- In-app browser initially blocked `localhost:3000` / `127.0.0.1:3000`; verification used the webpack dev server on port 3001.
- Could not submit a real report from the browser because the local route requires an authenticated session before a quiz card is available.
