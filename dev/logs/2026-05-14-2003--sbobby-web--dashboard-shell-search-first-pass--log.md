# Log: dashboard shell and search first pass

Date: 2026-05-14 20:03
Area: sbobby-web

## Summary

Implemented a first-pass dashboard UI foundation with a reusable app shell, left sidebar navigation, page header, section card, and empty-state primitives. Added a real `/search` page and `/api/search` route backed by published `QuestionView` data from the existing repository, including question text, options, answers, explanations, topics, source labels, evidence status, and user review stats.

## Files Changed

- `app/layout.tsx`: replaced the top-nav wrapper with the reusable app shell.
- `app/globals.css`: added shell, sidebar, page header, section card, empty state, and search result styles.
- `app/api/search/route.ts`: added authenticated search API.
- `app/search/page.tsx`: added search page route.
- `components/app/AppShell.tsx`: added route-aware shell wrapper that keeps login/onboarding outside the sidebar.
- `components/app/Sidebar.tsx`: added left sidebar navigation and active states.
- `components/app/PageHeader.tsx`: added reusable page header.
- `components/search/SearchPageClient.tsx`: added client search controls, filter state, result list, loading, error, and empty states.
- `components/ui/EmptyState.tsx`: added reusable empty state.
- `components/ui/SectionCard.tsx`: added reusable dashboard card primitive.
- `lib/search/indexer.ts`: maps existing question views into weighted search documents.
- `lib/search/normalize.ts`: adds normalization, tokenization, and snippet helpers.
- `lib/search/query.ts`: adds deterministic lexical scoring, status filtering, facets, and result shaping.
- `lib/search/repository.ts`: fetches eligible published questions and runs search.
- `lib/search/types.ts`: defines search request, document, result, and response types.

## Verification

- `npm run lint`: passed.
- `npm run build`: first sandboxed run failed with a Turbopack internal error because the sandbox blocked process/port binding during CSS processing; reran outside the sandbox and passed.
- `npm run dev`: started on `http://localhost:3000` for smoke checks.
- `curl -s -o /tmp/sbobby-login.html -w '%{http_code} %{url_effective}\n' http://127.0.0.1:3000/login/`: returned `200`.
- `curl -s -o /tmp/sbobby-studio.html -w '%{http_code} %{url_effective}\n' http://127.0.0.1:3000/studio/`: returned `200`.
- `curl -s -o /tmp/sbobby-search.html -w '%{http_code} %{url_effective}\n' http://127.0.0.1:3000/search/`: returned `200`.
- `curl -s -o /tmp/sbobby-admin.html -w '%{http_code} %{url_effective}\n' http://127.0.0.1:3000/admin/review/`: returned `200`.
- `curl -s -o /tmp/sbobby-search-api.json -w '%{http_code}\n' 'http://127.0.0.1:3000/api/search/?q=plexus'`: returned `401` while unauthenticated, as expected.

## Notes

- In-app Browser smoke could not be completed because the Browser plugin reported `Browser is not available: iab`.
- Search is lexical only; no DeepSeek call was added.
- `/studio?question=<id>` links are prepared as search result targets, but the current studio page may not yet select a specific question from that parameter.
