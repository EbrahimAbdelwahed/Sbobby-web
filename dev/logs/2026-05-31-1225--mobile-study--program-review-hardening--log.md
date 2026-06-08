# Log: mobile-study program review hardening

Date: 2026-05-31 12:25
Area: mobile-study

## Summary

Hardened mobile-study question filtering and tightened the DeepSeek program-review policy after production audit showed repeated false-eligible decisions for cochlea/vestibular/acoustic-pathway and perineum cases. Applied a targeted production DB patch to seven published questions that were still `program_eligible=true`.

## Files Changed

- `app/api/questions/route.ts`: requests with `/mobile-study` referer now require current-program eligibility even if an older client omits `requireProgramEligible=1`.
- `lib/llm/program-review.ts`: bumped prompt version to `mobile-skip-program-review-v2` and explicitly excludes internal ear/cochlea/vestibular/acoustic pathway/VIII nerve plus pelvic floor/perineum content.
- `dev/plans/2026-05-31-1225--mobile-study--program-review-hardening--plan.md`: implementation plan.

## Production Data Patch

- Marked six internal-ear/vestibular/acoustic questions `program_eligible=false` with reason `excluded_inner_ear_vestibular_acoustic`.
- Marked one perineum landmarks question `program_eligible=false` with reason `excluded_abdomino_pelvic`.
- Verification query for published eligible anatomy questions matching these families returned `eligible_matches: 0`.

## Verification

- `npm run lint`: passed.
- `npm run build`: sandbox failed on known Turbopack port-binding restriction; escalated build passed.

## Notes

- Prior production sessions showed ineligible cards inside explicit-topic mobile sessions, proving an older/non-hardened client or path could bypass the program filter.
- The API referer guard is a compatibility hardening; the explicit mobile-study query parameter remains the main intended contract.
