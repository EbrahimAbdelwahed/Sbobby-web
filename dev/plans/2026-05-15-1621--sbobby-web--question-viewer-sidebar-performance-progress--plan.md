# Plan: question viewer, sidebar, performance, progress charts

Date: 2026-05-15 16:21
Area: sbobby-web

## Goal

Implement the next incremental product correction for Sbobby Web: open search/mistake questions in an in-page viewer, make navigation less intrusive and mobile-friendly, reduce perceived search/mistakes latency, and add real visual progress by subject/topic where the current data supports it.

## Relevant Architecture

- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4 in `app/globals.css`.
- App shell: `components/app/AppShell.tsx` wraps authenticated routes with `components/app/Sidebar.tsx`.
- Current sidebar: route-aware client component with local inline SVG icons and Italian labels. It is not collapsible. Mobile currently renders a horizontal text nav.
- Search/mistakes UI: `components/search/SearchPageClient.tsx` is used by `/search` and `/mistakes`; `/mistakes` passes `initialStatus="wrong"` and `fixedStatus`.
- Search data flow: client debounces requests to `/api/search`; the route calls `lib/search/repository.ts`; repository fetches real published question views through `getQuestions`; `lib/search/indexer.ts` builds documents; `lib/search/query.ts` applies filters and fuzzy scoring.
- Search result shape currently includes snippets and metadata, but not the full question payload. Result cards link to `/studio?question=<id>`.
- Full question data: `QuestionView` already contains question text, options, explanation, source chunks, source refs, topics, publication/review/reliability status, report count, and user stats.
- Direct question endpoint exists via `/api/questions?question=<id>` for published accessible questions.
- Study UI: `components/studio/ExamStudioApp.tsx` still owns the large study surface, stats tab, `StudyCard`, `QuestionChat`, `CardReportForm`, admin review, and list rendering.
- Stats endpoints: `/api/stats/topics` and `/api/stats/questions` exist. `getTopicStats` currently returns only reviewed topics, with attempts/wrong/correct. It does not include total published question count or unseen count per topic.
- Admin review: existing admin flow has published/unpublished/queue modes and edit support. This task should avoid broad admin changes unless needed for shared viewer reuse.

## 21stdev / 21st-magic Findings

21stdev MCP tools are available.

Used:

- `21st_magic_component_inspiration` with `question drawer`: useful pattern is a responsive Dialog/Drawer with scrollable body and structured header/footer. Do not import Vaul or shadcn primitives just for this; the app already has `@radix-ui/react-dialog`, so implement a small local Radix dialog/drawer-like modal using existing dependency and CSS.
- `21st_magic_component_inspiration` with `collapsible sidebar`: useful pattern is explicit desktop collapse state, icon-only collapsed rail, tooltip/title support, and mobile compact navigation. Avoid framer-motion/lucide dependency additions unless later justified.
- `21st_magic_component_inspiration` with `progress chart`: useful pattern is compact progress bars and metric breakdown cards. Avoid framer-motion/circular charts for this pass; use CSS bars with real numbers for performance and maintainability.

## Confirmed Problems

- `/search` and `/mistakes` result cards end with `Apri in Studio`, which redirects to `/studio?question=<id>` and exposes the study filter/session setup instead of simply letting the user read the card.
- `SearchPageClient` has only `SearchResult`, not the full question payload; a viewer needs either a detail fetch by id or an enriched search response. A targeted detail fetch is lower-risk and avoids bloating every search response.
- Search/mistakes latency is likely caused by repeated server-side `getQuestions(limit: 1000)` plus request-time indexing on every debounced query. `/mistakes` still builds the full published index, then filters status in memory.
- `SearchPageClient` starts with `data = null`, so both `/search` and `/mistakes` always show an index loading surface even for simple views.
- Sidebar is fixed-width on desktop and text-heavy on mobile. It cannot collapse to an icon rail.
- The mobile nav currently includes text labels, which can crowd small screens.
- Existing stats show three metric cards plus lists. There is no visual per-subject/topic progress chart. `getTopicStats` cannot compute unseen because it does not return total published questions per topic.
- `ExamStudioApp.tsx` is large. Reusing its full `StudyCard` directly in a modal would drag chat/report/rating side effects into read-only search/mistakes viewing.

## Scope

- In scope:
  - In-page read-only question viewer modal/drawer from search and mistakes.
  - Replace `Apri in Studio` as the primary action with `Apri dettaglio`; keep `Apri in Studio` as a secondary link inside the viewer if useful.
  - Collapsible desktop sidebar with icon-only collapsed state.
  - Mobile navigation with icon-only links and accessible labels.
  - First-pass performance improvements for search/mistakes without changing auth or publication rules.
  - Real progress visualization using existing/reasonably extended stats data.
  - Focused CSS/component additions.
  - Dev log and verification.

- Out of scope:
  - Full study page redesign.
  - New charting library unless a hard need appears.
  - New search engine, vector search, or SQL full-text migration.
  - Fake dashboard metrics.
  - Large decomposition of `ExamStudioApp.tsx`.

## Implementation Phases

1. Question detail viewer
   - Add a small reusable component such as `components/questions/QuestionDetailDialog.tsx`.
   - Use `@radix-ui/react-dialog` already in dependencies.
   - Fetch full question data on open through `/api/questions?question=<id>&limit=1`.
   - Render question text, options, correct answer, explanation/rationale, topic/source/status metadata, user stats, and source snippets.
   - Keep it read-only; do not include chat/report/rating in this first viewer unless trivial and explicitly safe.
   - Ensure escape-close, focus trap, accessible title/description, scrollable body, and mobile full-screen/bottom-sheet-like behavior through CSS.

2. Search/mistakes result integration
   - In `SearchPageClient`, hold selected question id/open state.
   - Change result primary action from Link to button opening the detail viewer.
   - Keep an optional secondary Studio link inside the dialog using existing `result.href`.
   - Preserve existing search, subject, status, fuzzy, and count behavior.

3. Search/mistakes performance
   - First measure or instrument lightly with `performance.now()`/console-free internal timing only if useful.
   - Avoid full repeated expensive work where possible:
     - Use a client-side request cache keyed by search params to avoid refetching identical results in one page session.
     - Consider lowering debounce for empty query after initial data or skipping setLoading full-panel flashes when prior data exists.
     - In `/mistakes`, keep `status=wrong` fixed but avoid UI that suggests a new full index load for every small change.
   - If server changes are small and safe, add a request-local/simple module cache for published search documents keyed by user and coarse filters, with short TTL. Do not cache unpublished/admin data in user search.

4. Sidebar collapse and mobile density
   - Add local collapsed state in `Sidebar`, persisted to `localStorage` if straightforward.
   - Add a compact icon button to collapse/expand on desktop.
   - Change shell grid width with a data attribute or CSS class.
   - Collapsed desktop: show mark + icons only, keep accessible labels via `aria-label`/`title`, hide footer text.
   - Mobile: render icon-only nav links with accessible labels; keep touch targets around 40px; avoid text labels except brand if space allows.
   - Keep existing routes and active state.

5. Progress charts
   - Extend stats data only as far as real data supports.
   - Preferred repository addition: a `getTopicProgressStats(userId)` or expanded `getTopicStats` that returns per topic/module/subject:
     - total published questions
     - reviewed unique questions
     - wrong attempts or wrong unique count if practical
     - correct attempts or correct unique count if practical
     - unseen = total - reviewed unique
   - Render compact horizontal progress bars in the `Revisioni` tab with labels and counts.
   - Keep current lists as review lists, visually separated from metric/progress charts.
   - Do not fake trend lines or charts without data.

6. Dev memory and verification
   - Add a completion log under `dev/logs/`.
   - Run `npm run lint`.
   - Run `npm run build`; if sandbox Turbopack port bind fails, rerun with approved escalation and record it.
   - Smoke `/search`, `/mistakes`, `/studio`, `/admin/review`; for unauthenticated API checks expect `401`.
   - If a local dev server is practical, verify modal open/close and mobile-ish width behavior.
   - Push focused, verified changes to GitHub while avoiding unrelated dirty files.

## Technical Decisions

- Question viewer: use Radix Dialog already installed, not a new drawer dependency. Use CSS media queries to make it feel like a contained dialog on desktop and full-height sheet on small screens.
- Data for viewer: fetch full published question by id through existing `/api/questions?question=...`, because search results should remain lightweight.
- Search performance: start with client request cache and smoother loading states; add server TTL cache for built search docs only if the implementation remains small and respects user-specific review stats.
- Sidebar icons: keep current local SVG icon strategy unless lucide is already added later. Do not add `lucide-react` just for this.
- Progress charts: custom CSS progress bars, no chart library in this pass.
- Mobile density: prioritize icon-only nav and readable modal content over trying to expose every desktop detail.

## Risks

- Reusing `StudyCard` inside the dialog could accidentally expose rating/chat/report side effects. Prefer a read-only viewer component.
- `/api/questions?question=<id>` enforces published access; keep that behavior. Admin unpublished viewing is not part of this viewer unless explicitly added later.
- Search caching must not leak user-specific review stats across users.
- Progress stats can double-count attempts if not clearly separated from unique reviewed questions. Label metrics precisely.
- Sidebar collapse changes shell layout and can affect every route.
- The repo has many unrelated dirty/untracked artifacts. Do not stage or revert unrelated files.

## Verification

- `npm run lint`
- `npm run build`
- HTTP smoke:
  - `/search`
  - `/mistakes`
  - `/studio`
  - `/admin/review`
  - unauthenticated `/api/search?q=azigos` returns `401`
  - unauthenticated `/api/questions?question=<known-id>` returns `401`
- Manual/browser checks:
  - `/search` result opens detail viewer without route change.
  - `/mistakes` result opens the same viewer.
  - Viewer shows question/options/answer/explanation/metadata from real data.
  - Escape and close button close viewer; focus is visible.
  - Sidebar collapses/expands on desktop and mobile nav is icon-only.
  - Revisioni includes real progress bars and no fake charts.
