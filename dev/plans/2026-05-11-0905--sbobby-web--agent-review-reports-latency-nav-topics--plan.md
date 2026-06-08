# Plan: Sbobby Web agent review, reports, latency, nav, fine topics

Date: 2026-05-11 09:05
Area: sbobby-web

## Goal

Add a guarded API surface that lets an admin agent list and update admin-review questions, add user-facing card reports, make site navigation consistent, and reduce perceived latency on the main study page.

## Scope

- In scope:
  - Admin/agent review API with small batches, safe fields, and audit metadata.
  - User card report API and UI controls with the three requested categories.
  - Shared global navigation across study, shared sessions, shared review, and admin review.
  - Low-risk latency improvements in the client loading flow.
  - Technical plan for fine-grained topic extraction/heatmap.
- Out of scope:
  - Full DeepSeek batch execution for fine-grained topics in this step.
  - Large schema refactors or destructive data rewrites.

## Approach

1. Extend schema/types/repository for card reports and agent review audit logging.
2. Add `/api/admin/agent/review` for GET/PATCH with admin session or `ADMIN_AGENT_TOKEN` bearer auth.
3. Add `/api/questions/[id]/reports` and a compact report UI inside study cards.
4. Add a reusable navigation component and mount it in all main pages.
5. Replace multiple initial study bootstrap requests with one `/api/bootstrap` route and defer stats loading until the stats tab or post-answer refresh.
6. Record a follow-up spec for precise-topic extraction and clustering.

## Risks

- An agent-write API can corrupt published content if fields are too broad; keep field allowlists and require explicit publication state.
- Report categories need normalized storage, not free-form-only flags.
- The fine-topic heatmap should be generated offline/batch-first to avoid adding latency to page requests.

## Verification

- `npm run lint`
- `npm run build`
- Browser smoke for navigation/login page rendering.
