# Log: mcq normalization audit

Date: 2026-05-10 00:00
Area: sbobby-web

## Summary

Added a deterministic MCQ normalization audit script and generated a report from `seed.json`, `exam_questions_embedded_options_parsed.jsonl`, and `windowjudge15`. No source data, DB state, or UI files were changed.

## Files Changed

- `scripts/pipeline/audit-mcq-normalization.mjs`: reusable audit harness for option parsing, answer-label mapping, and metadata contamination detection.
- `data/pipeline/normalization/mcq_normalization_audit.json`: machine-readable audit output with counts and candidate IDs.
- `data/pipeline/normalization/mcq_normalization_audit.md`: human-readable summary report.

## Verification

- `node scripts/pipeline/audit-mcq-normalization.mjs`: passed and wrote the report files.
- `node --check scripts/pipeline/audit-mcq-normalization.mjs`: passed.

## Notes

- The audit found 563 selectable MCQ rows after embedded-option parsing, 530 deterministically label-mappable answers in `windowjudge15`, and 1 metadata-contaminated row.
- The 33 unresolved selectable rows remain candidates for manual handling, but not for deterministic normalization under the requested constraints.
