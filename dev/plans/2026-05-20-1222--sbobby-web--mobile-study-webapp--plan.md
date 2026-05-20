# Plan: Mobile Study Webapp

Date: 2026-05-20 12:22
Area: sbobby-web

## Goal

Create a phone-first Sbobby study webapp that can be added to a phone home screen and used only for fast MCQ practice. The UX should follow Focus Mode: one setup flow, then one question at a time. The UI should follow Soft Study: warm neutral surfaces, restrained sage/teal accents, light and dark modes, minimal visual noise, and high readability for long sessions.

## Scope

- In scope:
  - Add a dedicated mobile route, recommended as `/mobile-study`, that bypasses the desktop app shell/sidebar.
  - Reuse the existing backend APIs and data model: `/api/bootstrap`, `/api/questions`, `/api/study-sessions`, `/api/review-events`, and `/api/questions/[id]/reports`.
  - Provide setup controls for subject, topic, question count, and optional wrong-before filtering if it can be included without clutter.
  - Provide MCQ flow with progress, selectable answers, automatic reveal, correct-answer state, explanation, skip, admin report, and next question.
  - Support light/dark mode within the mobile app, with persistence in localStorage and system preference as the initial default.
  - Add metadata/manifest affordances if practical so the route behaves well when linked from a phone home screen.
  - Keep implementation modular: route/page, focused client app, small UI subcomponents, and local helpers.
  - Record completion in `dev/logs/`.
- Out of scope:
  - Replacing `/studio` or changing the existing desktop study workflow.
  - New LLM/text-processing features.
  - New dependencies unless strictly necessary.
  - Admin review workflow changes.
  - Shared study session changes.

## Existing Context

- `sbobby-web` is Next.js 16 App Router.
- `app/layout.tsx` wraps routes in `components/app/AppShell.tsx`.
- `AppShell` currently treats `/login` and `/onboarding` as plain routes. The new mobile route should be added to this plain-shell list.
- `/studio` uses `components/studio/ExamStudioApp.tsx`, which already contains useful local helpers and behavior:
  - `jsonFetch`
  - `correctOptionIdFor`
  - MCQ option selection and answer reveal
  - `CardReportForm`
  - review event posting
- Avoid expanding `ExamStudioApp.tsx`; create new mobile-focused components instead.
- The backend already supports needed calls:
  - `GET /api/bootstrap`: user, subjects, topics, topic tree.
  - `GET /api/questions?subject=...&topic=...&limit=...&order=random`: question list.
  - `POST /api/study-sessions`: creates a study session for review events.
  - `POST /api/review-events`: records `wrong`, `partial`, `correct`, or `easy`.
  - `POST /api/questions/[id]/reports`: submits a card report.
- The existing worktree has many unrelated dirty and untracked files, especially `data/pipeline`. Do not revert, clean, delete, or stage unrelated files.

## UX Model

1. Entry/setup screen:
   - Minimal header: `Sbobby` and a compact light/dark toggle.
   - Subject selector.
   - Topic selector filtered by selected subject. Prefer a simple select for the first implementation; avoid a large tree picker on mobile.
   - Question count selector with compact presets such as 5, 10, 20, 30.
   - Primary CTA: `Inizia`.
   - If unauthenticated, redirect to `/login` or show a compact login-required state that links to `/login`.
2. Quiz screen:
   - Thin progress indicator and `n / total`.
   - Subject/topic context in small muted text.
   - Question text with generous line-height.
   - Four large answer rows, touch-friendly, stable dimensions.
   - Secondary actions: `Salta` and icon/button `Segnala`, visually subordinate.
   - Selecting an answer immediately locks choices and reveals feedback.
   - Correct answer is highlighted; wrong selected answer is highlighted differently.
   - Explanation appears below the options after answer reveal.
   - CTA changes to `Avanti`.
   - `Salta` moves forward without recording a review event.
3. Completion screen:
   - Session summary: answered, correct, wrong, skipped.
   - Actions: `Nuova sessione` and optional `Ripeti stesso set`.

## UI Direction

- Focus Mode UX:
  - No sidebar, dashboard, chat, sources, stats, shared-session controls, or admin controls.
  - Keep only setup, question, answer, explanation, skip, report, next.
- Soft Study UI:
  - Light mode: warm off-white background, white panels, charcoal text, sage/teal accent, soft borders.
  - Dark mode: warm graphite background, muted sage/teal accent, comfortable contrast, not pure black.
  - Restrained border radius: around 8px for panels and answer rows.
  - Avoid gradients, decorative shapes, nested cards, marketing copy, and toy flashcard styling.
  - Use responsive CSS with mobile as the primary target; still look acceptable on desktop narrow previews.

## Implementation Approach

1. Add route:
   - `app/mobile-study/page.tsx` renders a suspense fallback and `MobileStudyApp`.
   - Update `components/app/AppShell.tsx` plain route list to include `/mobile-study`.
   - Optionally add a nav link in `components/app/Sidebar.tsx` only if it does not clutter the desktop app; otherwise leave direct-link only for now.
2. Add components:
   - `components/mobile-study/MobileStudyApp.tsx`: orchestrates load/setup/session/question flow.
   - Consider small internal or sibling components: setup form, quiz card, report sheet/dialog, completion summary, theme toggle.
   - Keep types local unless reusable.
3. Add styling:
   - Prefer route-scoped class names in `app/globals.css`, e.g. `sb-mobile-study-*`, with CSS variables for light/dark mode under a route root data attribute.
   - Do not alter existing `sb-*` primitives in a way that changes desktop behavior.
4. Preserve backend contracts:
   - Do not create duplicate question/report/review APIs unless a real backend gap is found.
   - Use `POST /api/study-sessions` at session start and pass `sessionId` to review events.
   - Record selected MCQ answers as `correct` or `wrong` through existing `review-events`; skipped questions should not create a review event.
5. Add home-screen affordance:
   - Add or update metadata/manifest only if simple and supported by the app structure.
   - At minimum set route metadata title/description for `/mobile-study`.

## Risks

- Auth-gated browser verification may require an existing session; if not available, verify build/lint and document the browser limitation.
- Correct-answer parsing currently relies on explanation answer labels. Reuse the existing logic and be defensive if the correct option cannot be inferred.
- Topic selection can become cognitively heavy if the full topic tree is rendered. The first mobile version should use a compact subject-filtered topic select.
- Dark mode changes must be scoped to the mobile app and must not change the desktop dashboard unexpectedly.
- Per repository rules, verified web interface changes in `sbobby-web` should be pushed to GitHub after verification.

## Verification

- `npm run lint`
- `npm run build`
- `npm run verify:smoke` if environment/session allows.
- Browser/mobile viewport smoke for `/mobile-study`:
  - unauthenticated handling
  - setup screen
  - start session
  - select answer and reveal explanation
  - next question
  - skip question
  - report question
  - light/dark toggle persistence
  - completion screen

## Acceptance Criteria

- `/mobile-study` exists and is usable as a standalone mobile-first study webapp.
- The route does not show the desktop sidebar/top navigation.
- The user can choose subject, topic, and number of questions before starting.
- The user can answer MCQs, see correct answer and explanation, continue, and complete the session.
- The user can skip a question without recording an answer.
- The user can report a question to admin through the existing report endpoint.
- The UI has both light and dark mode and matches the Focus Mode + Soft Study direction.
- Existing `/studio`, `/search`, `/admin/review`, auth, shared sessions, and publication behavior are not intentionally changed.
