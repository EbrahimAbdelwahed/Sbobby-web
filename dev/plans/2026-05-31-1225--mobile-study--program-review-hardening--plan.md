# Plan: mobile-study program review hardening

Date: 2026-05-31 12:25
Area: mobile-study

## Goal

Stop mobile-study from repeatedly serving questions that are outside this year's effective anatomy program, including records already known to be ineligible and records DeepSeek previously dismissed because the policy prompt was too broad.

## Scope

- In scope:
  - Harden `/api/questions` so requests coming from `/mobile-study` require `program_eligible=true` even if the client omits the explicit parameter.
  - Update the DeepSeek mobile skip prompt with the newly confirmed exclusions: internal ear/cochlea/vestibular/acoustic pathway/VIII nerve and pelvic floor/perineum.
  - Apply a conservative production DB patch to known false-eligible records and resolved/dismissed skip reports.
- Out of scope:
  - Reworking the whole program classifier.
  - Changing admin/review `includeReview` behavior.
  - Removing the existing ability for non-mobile explicit topic views to inspect out-of-program cards.

## Approach

1. Add referer-based mobile-study program gating in `/api/questions`.
2. Tighten DeepSeek prompt rules for future skip reviews.
3. Dry-run affected production questions, then apply only the targeted false-eligible classes.
4. Verify lint/build and push.

## Risks

- Referer is a pragmatic guard for old mobile-study clients; the explicit `requireProgramEligible=1` remains the primary client-side contract.
- The retroactive DB patch must stay narrowly scoped to the user-confirmed topics to avoid removing valid questions.

## Verification

- `npm run lint`
- `npm run build`
- Read-only production query after mutation to confirm targeted records are ineligible.
