# Plan: Topic progress and largest clusters

Date: 2026-05-21 17:45
Area: sbobby-web

## Goal

Improve the stats view with a clear per-topic done/wrong/not-done chart and add a largest-clusters section using topic/module taxonomy groups.

## Scope

- In scope:
  - Use existing `/api/stats/topics` data for topic progress.
  - Treat `wrong + partial` attempts as `wrong`.
  - Treat topic/module branches as clusters for v1.
  - Count only active published questions visible to normal users.
  - Add top clusters by total published question count.
  - Keep charts dependency-free with CSS bars.
- Out of scope:
  - Importing pipeline concept clusters.
  - Changing review-event semantics.
  - Admin-only/unpublished counts.

## Approach

1. Inspect `getTopicStats`, `/api/stats/topics`, `TopicStat` types, and `ExamStudioApp` stats UI.
2. Keep existing topic stats contract if sufficient; otherwise add additive fields only.
3. Add repository support for largest topic/module clusters, preferably returned by `/api/stats/topics` as `clusters`.
4. Render stacked bars for reviewed/done, wrong attempts, and not-done with visible numeric labels.
5. Add a largest-clusters panel with subject/module/path, total, reviewed, wrong, and not-done.
6. Use existing Sbobby panel and badge styling; add minimal scoped CSS only if needed.
7. Add a focused dev log after implementation.

## Risks

- Attempts and unique reviewed counts are different units. Label `wrong` as error attempts.
- Joining topic branches can double count if a question is mapped to multiple descendant topics. Use `COUNT(DISTINCT q.id)` for question counts.

## Verification

- `npm run lint`
- `npm run build`
- Optional API smoke for `/api/stats/topics` if auth/session allows.
