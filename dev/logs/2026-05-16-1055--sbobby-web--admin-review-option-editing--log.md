# Log: admin review option editing

Date: 2026-05-16 10:55
Area: sbobby-web

## Summary

Corrected the admin review workflow for MCQ formatting reports. Admins can now read report details, edit the option texts on the same card, and add a missing option such as a fifth answer choice when processing merged two choices into one option.

## Files Changed

- `components/studio/ExamStudioApp.tsx`: added MCQ option editing controls and removed the incorrect split-card UI.
- `app/api/admin/questions/[id]/review/route.ts`: validates optional admin-submitted option updates.
- `lib/exam/repository.ts`: persists option replacement through the existing review update path and keeps open report details on admin payloads.
- `lib/exam/types.ts`: keeps optional report details on admin question views.
- `dev/plans/2026-05-16-1047--sbobby-web--admin-review-option-editing--plan.md`: implementation plan.

## Verification

- `npm run lint`: passed.
- `npm run build`: failed in sandbox with the known Turbopack internal port bind restriction, then passed outside the sandbox.

## Notes

- The previous split-card endpoint and dev memory entries were removed because the needed behavior is option editing within one MCQ card.
