# Note: mcq normalization rules

Date: 2026-05-10 00:00
Area: sbobby-web

## Context

`data/pipeline/exam_questions_embedded_options_parsed.jsonl` is the canonical normalized question set for this pass. It contains 684 rows, with 207 explicit `multiple_choice` rows and 356 `open` rows that were converted into selectable MCQ via embedded-option parsing.

`windowjudge15` is label-mappable for 530 of those 563 selectable rows when the answer is reduced to a standalone choice label `A`-`F` and matched against the existing option labels after normalization.

Only one row in the parsed artifact is contaminated by explicit metadata in the question text / raw text: `q_299a9cabeb6e`.

## Implication

Future normalization work should stay strictly within extraction, cleanup, and label mapping. Do not infer answers from prose, explanation text, or source evidence, and do not generate new options for open questions.

## References

- `scripts/pipeline/audit-mcq-normalization.mjs`
- `data/pipeline/normalization/mcq_normalization_audit.md`
