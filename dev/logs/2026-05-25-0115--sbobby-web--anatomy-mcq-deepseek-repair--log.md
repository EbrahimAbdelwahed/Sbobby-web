# Log: Anatomy MCQ DeepSeek repair

Date: 2026-05-25 01:15
Area: sbobby-web

## Summary

Added a dedicated DeepSeek v4 flash repair script for the 73 unpublished Anatomy MCQs. The script is conservative: it targets only active Anatomy `multiple_choice` questions in `needs_repair`, validates every model output deterministically, rejects ambiguous/low-confidence/malformed outputs, and can apply accepted repairs with per-question rollback snapshots.

Dry-run results before DB apply:

- First strict full dry-run: `73` scanned, `63` accepted, `10` rejected, `0` errors.
- Follow-up gate review found one unstable ambiguous item (`q_49bf57dd441e`) to force-reject and three numeric-option items that should be accepted after relaxing the too-strict semantic drift check for numeric options.
- Estimated safe apply yield after gate patch: about `65` of `73`.

Apply was completed from local candidate artifacts without additional DeepSeek calls after the live DeepSeek+Neon apply path was rejected by policy. The candidate-file apply published `65` of the `73` target Anatomy MCQs. The remaining `8` stayed in `needs_repair` because they were multi-answer, ambiguous, evidence-weak, or malformed.

Final DB state for Anatomy MCQs:

- `published`: `451` (was `386` before this pass)
- `needs_repair`: `8` (was `73`)
- `not_recoverable`: `6`

The script initially applied the question/option/explanation updates but failed to write `agent_review_logs` because the real table uses `actor_user_id`/`patch`, not `reviewer_id`/`payload`. The script was corrected and `65` audit logs were backfilled.

## Files Changed

- `scripts/pipeline/repair-anatomy-mcq-deepseek.mjs`: new DeepSeek repair script with dry-run/apply, local candidate-file apply, deterministic validation, reports, and rollback snapshots.
- `package.json`: added `repair:anatomy-mcq` script.
- `dev/plans/2026-05-25-0105--sbobby-web--anatomy-mcq-deepseek-repair--plan.md`: implementation plan.

## Verification

- `node --check scripts/pipeline/repair-anatomy-mcq-deepseek.mjs`: passed.
- `node scripts/pipeline/repair-anatomy-mcq-deepseek.mjs --limit 5 --out-dir data/pipeline/anatomy-mcq-deepseek-repair-smoke`: passed; `5` scanned, `4` accepted, `1` rejected.
- `node scripts/pipeline/repair-anatomy-mcq-deepseek.mjs --out-dir data/pipeline/anatomy-mcq-deepseek-repair`: passed; `73` scanned, `63` accepted, `10` rejected.
- `npm run repair:anatomy-mcq -- --candidate-file data/pipeline/anatomy-mcq-deepseek-repair/accepted.jsonl,data/pipeline/anatomy-mcq-deepseek-repair/rejected.jsonl --out-dir data/pipeline/anatomy-mcq-deepseek-repair-candidate-dryrun`: passed; `73` scanned, `65` accepted, `8` rejected.
- `npm run repair:anatomy-mcq -- --candidate-file data/pipeline/anatomy-mcq-deepseek-repair/accepted.jsonl,data/pipeline/anatomy-mcq-deepseek-repair/rejected.jsonl --apply --out-dir data/pipeline/anatomy-mcq-deepseek-repair-apply`: applied DB updates for `65` questions; summary file under-reports `applied` due the audit-log schema error during the run, but DB verification confirms `65` published by `anatomy_mcq_deepseek_repair`.
- Backfilled `65` `agent_review_logs` rows after correcting the schema names.
- `npm run verify:mcq`: passed with zero failures.
- `npm run program-eligibility`: passed; `490` published MCQs, `308` program-eligible published questions.
- `npm run lint`: passed.

## Notes

- The apply rollback file for the successful mutation attempt is:
  - `data/pipeline/anatomy-mcq-deepseek-repair-apply/rollback_2026-05-25T15-35-51-874Z.jsonl`
- The summary file in `data/pipeline/anatomy-mcq-deepseek-repair-apply/summary.json` shows `applied: 0` because the original audit-log insert failed after each question update. Use DB verification and the backfilled audit log count as authoritative for the applied result.
