# Plan: mcq normalization audit

Date: 2026-05-10 00:00
Area: sbobby-web

## Goal

Audit `data/seed.json`, the embedded-options parsed artifact, and `windowjudge15` to quantify how many cards are already selectable MCQ, how many answers can be deterministically mapped to an option, and which rows are contaminated by metadata.

## Scope

- In scope:
  - Read-only analysis of `data/seed.json`.
  - Read-only analysis of `data/pipeline/exam_questions_embedded_options_parsed.jsonl`.
  - Read-only analysis of `data/pipeline/rag_answers_684_top12_partial_plus_grep_all_hard_residual60_pageindex_grep_parsedopts4_windowjudge15_reconciled.jsonl`.
  - New audit script/report under `scripts/pipeline/` and `data/pipeline/normalization/`.
- Out of scope:
  - Editing seed data, database state, or UI components.
  - Semantic rewriting or answer generation.

## Approach

1. Derive deterministic counts from the parsed artifact and the `windowjudge15` answer file.
2. Use only extraction/cleaning/mapping rules for answer labels and embedded options.
3. Write a small reusable script plus a generated audit report with candidate IDs and unresolved IDs.

## Risks

- Metadata detection can be overbroad if regexes are too loose.
- The report must stay strictly descriptive and avoid semantic inference.

## Verification

- `node scripts/pipeline/audit-mcq-normalization.mjs`
