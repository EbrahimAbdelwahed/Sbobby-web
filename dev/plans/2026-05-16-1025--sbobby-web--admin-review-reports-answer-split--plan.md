# Plan: admin review reports and answer split

Date: 2026-05-16 10:25
Area: sbobby-web

## Goal

Make admin review usable for reported formatting errors by showing report details and allowing an admin to split a wrongly merged answer into two reviewable cards.

## Scope

- In scope:
  - Add open report details to admin review question payloads.
  - Surface report reason, note, status, and timestamp in each admin review card.
  - Add a focused admin split action that keeps edited content on the current card and creates a second unpublished/needs-review sibling card with the split-out answer.
- Out of scope:
  - Automatic LLM splitting or semantic rewriting.
  - Bulk report management UI.
  - Changes to normal study flow.

## Approach

1. Extend `QuestionView` with optional `reports` and populate it in repository view mapping.
2. Add repository/API support for cloning a question row plus explanation into a new question with admin-provided answer/explanation/rationale fields.
3. Add admin UI controls in review cards to read reports and submit the split.
4. Verify lint/build where practical and record outcomes.

## Risks

- Duplicating rows must preserve source/topic metadata while keeping the new card unpublished and review-gated.
- The existing DB schema may have required question columns; inspect insert patterns before writing SQL.

## Verification

- `npm run lint`
- `npm run build` if local dependencies/environment allow it.
