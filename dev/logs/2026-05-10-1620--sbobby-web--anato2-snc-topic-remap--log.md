# Log: Anatomia 2 SNC topic remap

Date: 2026-05-10 16:20
Area: sbobby-web

## Summary

Fixed the Anatomia 2 tagging script so questions grounded in `ANATO 2 CUSELLA 2024-2025` are not left under the incorrect `anatomia_architettura_generale_del_snc_e_periferico` topic.

The previous script added the new `anatomia_2_cusella_source_questions` topic but kept the old topic mapping. The updated script now removes that misplaced SNC mapping for the same source-grounded question set.

## Files Changed

- `scripts/pipeline/tag-anato2-cusella-questions.mjs`: removes the misplaced SNC topic from Anatomia 2 source questions and prints before/after counts.

## Database Outcome

- Removed `63` Anatomia 2 source-grounded mappings from `anatomia_architettura_generale_del_snc_e_periferico`.
- Remaining Anatomia 2 source-grounded mappings under that SNC topic: `0`.
- `anatomia_2_cusella_source_questions` remains at `131` total tagged questions: `106` published and `25` unpublished.
- `anatomia_architettura_generale_del_snc_e_periferico` now has `20` total questions, `11` published.

## Verification

- `node --check scripts/pipeline/tag-anato2-cusella-questions.mjs`: passed.
- `npm run tag:anato2-cusella`: passed against Neon.
- `npm run verify:mcq`: passed against Neon.
- `npm run lint`: passed.

## Notes

- The first sandboxed `npm run verify:mcq` failed with DNS `ENOTFOUND` to Neon; rerunning with network access passed.
