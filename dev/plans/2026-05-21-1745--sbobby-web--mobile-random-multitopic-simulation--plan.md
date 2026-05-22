# Plan: Mobile random and multitopic simulation

Date: 2026-05-21 17:45
Area: sbobby-web

## Goal

Extend `/mobile-study` setup so a user can start a simulation from one topic, multiple selected topics, or a random set of topics under the chosen subject.

## Scope

- In scope:
  - Preserve the already implemented mobile `Termina simulazione` flow.
  - Add a compact mobile setup mode selector: all topics, manual multitopic, random topics.
  - Let manual mode select multiple eligible topics.
  - Let random mode choose a small random set of eligible topics with published questions.
  - Send the same `topics[]` list to `POST /api/study-sessions` and `GET /api/questions`.
  - Store selected random/manual topics in session filters.
- Out of scope:
  - Desktop `/studio` redesign.
  - New dependencies.
  - Shared-session creation changes beyond keeping filters compatible.

## Approach

1. Inspect current `components/mobile-study/MobileStudyApp.tsx` and preserve all finish-session code.
2. Replace the single-topic setup state with a topic mode plus `selectedTopicIds`.
3. Use `TopicWithModule.questionCount` to filter random/manual candidates to topics with available questions.
4. For random mode, shuffle eligible subject topics and select the configured count.
5. Build request params by appending each selected topic as repeated `topic`.
6. Keep the UI compact: a segmented mode control, count buttons for random topic count, and a scrollable checkbox list for manual topics.
7. Add a focused dev log after implementation.

## Risks

- Mobile setup can become visually crowded. Keep text short and controls touch-friendly.
- Existing finish-session local changes are dirty; do not overwrite them.
- If a subject has fewer eligible topics than requested, use all available and show normal session behavior.

## Verification

- `npm run lint`
- `npm run build`
- Manual/browser smoke if authenticated session is available.
