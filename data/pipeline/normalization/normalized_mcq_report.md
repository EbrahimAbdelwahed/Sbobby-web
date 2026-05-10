# MCQ normalization report

Mode: apply
Artifact: `data/pipeline/rag_answers_684_top12_partial_plus_grep_all_hard_residual60_pageindex_grep_parsedopts4_windowjudge15_reconciled.jsonl`

## Counts

- Total questions: 684
- Questions with existing options: 207
- Raw text parseable MCQ: 561
- Valid four-option MCQ: 556
- Supported rows among valid MCQs: 462
- Mapped supported MCQs: 446
- Question metadata cleanups detected: 249
- Unpublished/admin-review by policy: 238

## Rejected reasons

- not_valid_four_option_mcq: 128
- not_supported_by_windowjudge15: 94
- answer_not_mappable_to_option: 16

## Policy

The script does not rewrite semantic content, generate distractors, or convert open questions into MCQs.
It only extracts A/B/C/D options already present in raw text or structured options, removes known technical metadata tails, and maps an existing supported answer to one option.
