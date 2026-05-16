# Log: admin review reports and answer split

Date: 2026-05-16 10:36
Area: sbobby-web

## Summary

Admin review now shows open report details directly on each reported card and includes a focused split action for cards where one answer was incorrectly merged from two answers. The split keeps the current edited answer on the original card, creates a second unpublished review-gated sibling card, and preserves topics, options, source references, source chunks, and external evidence as review context.

## Files Changed

- `components/studio/ExamStudioApp.tsx`: shows report reason/note/timestamp in admin cards and adds split-answer UI.
- `app/api/admin/questions/[id]/split-answer/route.ts`: adds an admin-only split endpoint.
- `lib/exam/repository.ts`: attaches open reports only to admin/agent review payloads and implements split cloning.
- `lib/exam/types.ts`: adds optional admin-only reports on `QuestionView`.
- `dev/plans/2026-05-16-1025--sbobby-web--admin-review-reports-answer-split--plan.md`: implementation plan.

## Verification

- `npm run lint`: passed.
- `npm run build`: failed in sandbox with the known Turbopack internal port bind restriction, then passed outside the sandbox.
- `npm run dev`: failed in sandbox with `listen EPERM`; outside the sandbox the server started but exited on a local persistence directory/database error: `invalid digit found in string`.

## Notes

- The new split card is intentionally `unpublished`, `reviewing`, `needs_review`, and `needs_human_review = true`; admins must still review/publish it manually.
- Open report details are not added to normal study payloads; they are attached only to admin list and agent review queue responses.
