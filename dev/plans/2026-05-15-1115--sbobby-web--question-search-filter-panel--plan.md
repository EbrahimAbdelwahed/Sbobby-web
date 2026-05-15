# Plan: question search/filter panel polish

Date: 2026-05-15 11:15
Area: sbobby-web

## Goal

Refactor the current question search/filter controls into a compact, polished, accessible panel for the medical-study dashboard while preserving the real search/filter behavior already connected to `/api/search`.

## Relevant Architecture

- The user-facing search UI lives in `components/search/SearchPageClient.tsx`.
- `/search` and `/mistakes` both render `SearchPageClient`; `/mistakes` passes `initialStatus="wrong"` and `fixedStatus`.
- Search state is local React state: `query`, `subject`, and `status`.
- Search requests are debounced in `SearchPageClient` and sent to `/api/search` with `q`, `subject`, `status`, and `limit`.
- `/api/search/route.ts` validates auth, parses the filters, and calls `searchQuestions`.
- Search indexing/ranking lives in `lib/search/indexer.ts`, `lib/search/query.ts`, `lib/search/fuzzy.ts`, and `lib/search/normalize.ts`.
- Current search documents include question text, raw text, answers/options, explanations/rationale, subject, topic/module path, source labels, review status, evidence status, reliability label, and per-user stats.
- Facet counts are returned in `SearchResponse.facets` and currently computed over the full document set in `lib/search/query.ts`.
- Styling is Tailwind CSS 4 plus app-level utility classes in `app/globals.css`; current search controls use `.sb-search-controls`, `.sb-input`, `.sb-label`, `.sb-filter-segments`, and `.sb-filter-segment`.
- `SectionCard` provides a reusable rounded section wrapper, but the current composition lacks a clear local title/subtitle/search/filter hierarchy.

## Confirmed Problems

- The search/filter layout puts search, subject, and status in one grid row on desktop, making the panel bulky and visually cramped.
- The search label consumes vertical space; requested placeholder should be `Cerca nelle domande...`.
- The subject label/select can feel cramped in the desktop grid.
- Status filter buttons are too tall and read like large segmented form buttons instead of compact chips.
- Active filter styling is stronger than needed and makes the counts visually heavy.
- The panel lacks the requested local hierarchy: `Domande`, subtitle, full-width primary search, then filters.
- The fixed mistakes page currently hides all status choices except `Errori`; this is functional, but the UI should still make the active state clear and compact.
- `SearchPageClient` already uses real data and should not be replaced with static mock results.

## Scope

- In scope:
  - Refactor `SearchPageClient` search/filter panel markup.
  - Adjust or add focused CSS utility classes in `app/globals.css`.
  - Preserve `/search` and `/mistakes` behavior.
  - Preserve existing search API, indexing, fuzzy ranking, and result rendering unless a small fix is required.
  - Update `AGENTS.md` with the durable workflow rule for non-trivial changes.
  - Add a factual completion log in `dev/logs/`.

- Out of scope:
  - Large dashboard redesign.
  - New search backend or dependencies.
  - Admin review changes.
  - Search result card redesign beyond incidental spacing needed for the panel.

## Implementation Approach

1. Add the durable workflow instruction to `AGENTS.md` under the core/project rules without removing existing instructions.
2. In `SearchPageClient`, replace the current flat control grid with a panel:
   - local header title `Domande`
   - subtitle `Cerca e filtra le domande per materia e stato.`
   - full-width search input with accessible label and placeholder `Cerca nelle domande...`
   - lower filter row with compact `Materia` select on the left and status chip group on the right.
3. Keep state and fetch behavior intact:
   - `query`, `subject`, `status`, debounce, `/api/search`, `SearchResponse`, facets, fixed mistakes status.
   - Add helper functions only if they reduce repeated facet lookup for counts.
4. Improve accessibility:
   - Use `htmlFor`/`id` or clear labeled wrappers for search/select.
   - Use `aria-label` for the status group.
   - Use `aria-pressed` on status buttons.
   - Preserve native keyboard support for input/select/buttons.
5. Add small, reusable CSS classes or Tailwind class strings for:
   - soft white rounded panel with subtle border/shadow.
   - compact filter row responsive behavior.
   - pill-shaped status chips.
   - small count badges.
   - subtle teal active chip state and visible focus state.
6. Verify responsive behavior from CSS:
   - mobile stacks search, subject, chips.
   - desktop keeps search full-width with lower filter row.
   - chips wrap intentionally.
7. Run `npm run lint` and `npm run build` from `sbobby-web` if possible.
8. Add a completion log with files changed and verification.
9. Push verified web UI changes to GitHub per project rules.

## Risks

- The component serves both `/search` and `/mistakes`; avoid wording or fixed-status behavior that makes the mistakes page confusing.
- Facet counts currently come from the full document set, not the currently selected subject/query. Preserve this unless deliberately changing it, because changing count semantics could alter behavior.
- Avoid creating a second search panel component unless the existing component becomes materially clearer; this should stay small.
- Native select is acceptable if styled compactly and accessibly; do not add a dependency for a custom dropdown.
- The repository already has unrelated dirty/untracked artifacts. Do not stage or revert unrelated files.

## Verification

- `npm run lint`
- `npm run build`
- Manual/browser smoke if practical:
  - `/search` renders `Domande` panel, full-width search, compact subject select, compact status chips, and real results.
  - `/mistakes` renders the same panel with the wrong/error status fixed and still searches wrong questions.
  - Combining query + materia + stato updates API results.
  - Keyboard focus is visible on input, select, and chips.
