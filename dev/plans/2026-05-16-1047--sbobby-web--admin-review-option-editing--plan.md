# Plan: admin review option editing

Date: 2026-05-16 10:47
Area: sbobby-web

## Goal

Let admins fix reported MCQ formatting errors on the same card by editing existing option text and adding a missing option.

## Scope

- In scope:
  - Show open report details in admin review.
  - Add editable MCQ options to each admin review card.
  - Persist option edits/additions/removals through the existing admin review PATCH endpoint.
- Out of scope:
  - Creating extra cards from a split answer.
  - Automatic LLM parsing of merged option text.

## Approach

1. Keep report detail attachment restricted to admin review payloads.
2. Extend `ReviewDraft` and the review card UI with option editors and an add-option action.
3. Extend `updateQuestionReview` to replace the question options after validating non-empty unique labels and text.
4. Verify with lint and build.

## Risks

- Option replacement deletes and reinserts `question_options`; it preserves labels/text but does not preserve unchanged row ids when the admin removes/reorders manually.
- Admins must also update the correct answer field if the newly added option changes the answer label.

## Verification

- `npm run lint`
- `npm run build`
