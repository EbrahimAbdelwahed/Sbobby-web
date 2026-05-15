# Log: question search/filter panel polish

Date: 2026-05-15 11:22
Area: sbobby-web

## Summary

Polished the real question search/filter panel into a compact card with local title/subtitle hierarchy, full-width search input, compact materia select, and pill-shaped status chips while preserving the existing debounced `/api/search` behavior.

## Files Changed

- `components/search/SearchPageClient.tsx`: restructured the controls into the requested panel hierarchy, added accessible input/select labels, `aria-pressed` status chips, and preserved local query/subject/status state with existing API requests.
- `app/globals.css`: added focused `sb-question-*` classes for the search panel, responsive filter row, subtle teal active chips, visible focus states, and small count badges.
- `AGENTS.md`: added the durable workflow rule for non-trivial changes and sub-agent delegation.
- `dev/logs/2026-05-15-1122--sbobby-web--question-search-filter-panel--log.md`: recorded this work.

## Verification

- `npm run lint`: passed.
- `npm run build`: sandboxed build failed with Turbopack local port binding `Operation not permitted`; escalated rerun passed.
- `curl -s -L -o /dev/null -w '%{http_code} %{url_effective}\n' http://localhost:3000/search`: `200 http://localhost:3000/search/`.
- `curl -s -L -o /dev/null -w '%{http_code} %{url_effective}\n' http://localhost:3000/mistakes`: `200 http://localhost:3000/mistakes/`.
- Browser smoke: `/search` and `/mistakes` both rendered the new `Domande` panel copy; `/mistakes` retained the `Errori` status surface.

## Notes

- Search API, indexing, ranking, and facet count semantics were not changed.
- The requested gpt-5.5-low sub-agent delegation could not be performed because no sub-agent delegation tool is exposed in this session; the implementation still followed the inspect, plan, implement, review, and verify workflow.
