# Log: external evidence review queue cleanup

Date: 2026-05-11 13:20
Area: sbobby-web

## Summary

Added first-class external-source support for admin/agent question review and used the admin agent API to clear the admin/review queue. Questions that could be verified from local chunks were published as supported; questions requiring outside evidence were published as externally supported with structured source metadata; malformed, duplicate, contaminated, or non-recoverable cards were closed as not recoverable.

## Files Changed

- `lib/exam/types.ts`: added external source metadata and `externally_supported` evidence status.
- `lib/exam/repository.ts`: added schema columns for external sources, updated publication gating, review queue filtering, and review patch persistence.
- `app/api/admin/agent/review/route.ts`: allowed structured `externalSources` in agent patches and documented the external evidence contract.
- `app/api/admin/questions/[id]/review/route.ts`: accepted external evidence fields from admin review updates.
- `app/api/questions/[id]/chat/route.ts`: included approved external sources in chatbot context and citations.
- `components/studio/ExamStudioApp.tsx`: exposed externally supported evidence in admin UI and displayed external sources in study/admin cards.

## Verification

- `GET /api/admin/agent/review/?limit=50` with `ADMIN_AGENT_TOKEN`: returned `count: 0`, `nextCursor: null` after cleanup.
- `npm run lint`: passed.
- `npm run build`: passed.

## Notes

- The cleanup changed database state through the audited admin agent API, not repository seed files.
- External web evidence is deliberately distinct from local chunk evidence; source chunk IDs were not fabricated for web-resolved cards.
- Final-state rejected/not-recoverable cards are excluded from the active review queue unless they receive new open reports.
