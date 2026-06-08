# Log: question repair and program eligibility

Date: 2026-05-25 00:00
Area: sbobby-web

## Summary

Completed the deterministic repair pass for malformed published questions and activated current-program eligibility filtering for normal study flows.

Public published cards are now selectable MCQs only. True open-answer cards, unsupported cards, and ambiguous MCQ repairs were moved to `needs_repair`. `Tutti` now uses `program_eligible = true`, and `/mobile-study` bootstrap topic counts use the same published-eligible scope so random/manual mobile topic selection does not default to out-of-program topics.

Program policy decisions implemented:

- Anatomia 2 is always excluded, including when a card mentions pancreas, milza, or surrene.
- True open-answer cards are not public.
- Mammella is treated as thorax material, not reproductive-system exclusion.
- Explicit topic selection can still show published out-of-program cards; implicit `Tutti`, direct public access, shared-session question loading, stats, clusters, and mobile bootstrap counts require eligibility.

## Files Changed

- `app/api/bootstrap/route.ts`: uses published-eligible topic counts for bootstrap/mobile.
- `lib/exam/program-eligibility.ts`: new pure policy helper for current-program eligibility.
- `lib/exam/repository.ts`: adds additive eligibility schema columns/index, maps fields, gates implicit public surfaces, and supports eligible topic counts.
- `lib/exam/types.ts`: adds eligibility fields to `Question`.
- `package.json`: adds program eligibility and question repair scripts.
- `scripts/pipeline/normalize-mcq-cards.mjs`: supports A-F / 2-6 option extraction and safer containment mapping.
- `scripts/pipeline/repair-question-db.mjs`: new dry-run/apply/rollback repair pipeline.
- `scripts/pipeline/update-program-eligibility.mjs`: new dry-run/apply program eligibility classifier.
- `scripts/pipeline/verify-mcq-publication.mjs`: stricter publication verifier.

## Database Outcome

- `npm run repair:questions -- --out-dir=/private/tmp/sbobby-question-repair-apply --apply`:
  - scanned `651` rows;
  - applied `651` row updates;
  - repaired `425` MCQs automatically;
  - moved `131` open/statement cards to repair/admin state;
  - moved `25` answer-ambiguous MCQs to repair/admin state;
  - moved `70` evidence-unsupported cards to repair/admin state.
- Rollback snapshot:
  - `/private/tmp/sbobby-question-repair-apply/question_repair_rollback_2026-05-24T14-16-30-286Z.jsonl`
- `npm run program-eligibility:apply`:
  - `425` published MCQs total;
  - `251` published eligible MCQs in the implicit `Tutti`/mobile pool;
  - `174` published but ineligible for implicit `Tutti`.
- Published ineligible reasons after apply:
  - `excluded_anatomia_2`: `108`
  - `excluded_abdomino_pelvic`: `44`
  - `excluded_reproductive`: `20`
  - `unclassified_no_topic`: `2`

## Verification

- `node --check scripts/pipeline/update-program-eligibility.mjs`: passed.
- `node --check scripts/pipeline/repair-question-db.mjs`: passed.
- `node --check scripts/pipeline/verify-mcq-publication.mjs`: passed.
- `npm run lint`: passed.
- `npm run build`: first sandboxed run failed with the known Turbopack process/port permission issue; escalated rerun passed.
- `npm run verify:mcq`: passed after repair and eligibility apply.
- Direct Neon count check: published `425`, published eligible `251`, published ineligible `174`, mobile all pool `251`.
- Targeted topic count check:
  - Anatomia 2 source topic eligible count `0`, ineligible count `108`.
  - Mammella topic counts remain eligible where published.
  - Surreni and pancreas retain eligible published counts where not Anatomia 2.

## Notes

- The public verifier intentionally validates publication shape, not whether every published card is program eligible, because explicit topic selection may still show published out-of-program material.
- Admin review queue now contains the ambiguous and unsupported repair buckets for manual follow-up.
