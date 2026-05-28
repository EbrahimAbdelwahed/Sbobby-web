# Plan: mobile-study program filter, mistakes mode, subject stats

Date: 2026-05-28 15:48
Area: mobile-study

## Goal

Make mobile-study stop serving program-ineligible questions, add a mode that prioritizes questions the user last answered incorrectly, and show per-subject progress counts.

## Scope

- In scope:
  - Force current-program eligibility for mobile-study question fetches.
  - Add a question order that serves last-wrong questions first, then unseen questions.
  - Expose a mobile-study setup toggle for wrong-first sessions.
  - Add subject-level progress stats to the existing stats API and mobile UI.
- Out of scope:
  - Changing the global explicit-topic behavior outside mobile-study.
  - Automatically mutating existing production question eligibility.
  - Adding new dependencies.

## Approach

1. Extend repository query filters with a force-program-eligible option and a last-wrong-first order.
2. Wire the API query parameter and study-session filter storage.
3. Update mobile-study state, setup controls, session creation, and question fetch.
4. Add subject stats query and render a compact per-subject progress panel.

## Risks

- Existing production cards already misclassified as `program_eligible=true` still require the DeepSeek review/repair path; this change blocks only cards already marked ineligible.
- Last-wrong prioritization depends on `review_events` being recorded correctly.

## Verification

- `npm run lint`
- `npm run build` if sandbox permits, otherwise record the blocker.
