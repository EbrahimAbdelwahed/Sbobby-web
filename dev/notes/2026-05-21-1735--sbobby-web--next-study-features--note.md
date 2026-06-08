# Note: next study features

Date: 2026-05-21 17:35
Area: sbobby-web

## Context

The next requested Sbobby Web work is a bundle of study-flow and analytics improvements:

- finish a mobile study session
- random simulation with random topics
- multitopic simulation chosen by the user
- per-topic chart of done, wrong, and not-done questions
- clusters/topics with the largest number of questions
- join shared sessions from the web app

Existing code already has useful primitives, but product-visible behavior still needs verification:

- `/mobile-study` exists in `components/mobile-study/MobileStudyApp.tsx`.
- The mobile app must get a visible, user-facing `Termina simulazione` action. Do not assume it exists just because local dirty worktree code may contain a partial implementation.
- The repository has or is expected to have supporting session-completion primitives: a `PATCH /api/study-sessions/[id]` route, `completed_at` and `state` fields on `study_sessions`, and a mobile session snapshot. Verify these before implementing.
- `GET /api/questions` already accepts repeated `topic` query params and repository filters already support `topics`.
- Desktop `/studio` already supports selecting multiple topic tree nodes and creating/joining shared sessions.
- Mobile study currently uses a single topic select and sends at most one topic.
- `getTopicStats` already returns `totalQuestions`, `reviewedQuestions`, `unseenQuestions`, `attempts`, `wrong`, `correct`, and `problemScore`.
- Shared session join already exists through `POST /api/shared-sessions` with `{ code }`, but the public entry is currently embedded in `/studio`.

## Feature Definitions

### 1. Finish session in mobile study

Status: implemented before the remaining feature orchestration. Preserve the existing behavior while adding the other features.

Expected behavior:

- During a mobile quiz, the user can tap `Termina simulazione`.
- The app saves a session snapshot with reason `ended_early`, current index/question, total questions, question ids, summary, and filters.
- Natural completion saves reason `completed`.
- Existing per-answer `review_events` remain the source of answer history; the session snapshot is only session-level state.
- After save, the user lands on the same completion summary used for natural completion.

Acceptance criteria:

- A visible `Termina simulazione` button/action is present during the mobile quiz.
- Ending early persists `completed_at` and JSON `state` for the authenticated user session.
- Save failure leaves the user in quiz state and shows an error.
- Existing answer recording, skip, report, and repeat filters behavior keep working.

### 2. Random simulation and multitopic simulation

Define these as one shared filter-model improvement, then apply it where needed.

Random topic simulation:

- User selects a subject and a mode such as `Argomenti casuali`.
- User chooses how many topics to draw, or accepts a small default such as 3.
- Backend/client chooses random eligible published topics under the selected subject, excluding topics with 0 published questions.
- Questions are then drawn randomly from the union of those topic branches.
- The selected random topic ids are stored in `study_sessions.filters.topics` so the session can be inspected later.

Multitopic simulation:

- User can manually select more than one topic/module under a subject.
- Selecting a module includes descendant topics, matching existing desktop `TopicPicker` behavior.
- Questions are drawn from the union of selected topic branches, not from an intersection.
- Topic selection must remain compact on mobile; prefer a searchable sheet/list over rendering the full desktop tree inline.

Acceptance criteria:

- Personal study session creation and question fetch use the same topic id array.
- Desktop `/studio` keeps existing multitopic behavior.
- `/mobile-study` supports single-topic, multitopic, and random-topic modes without large UI clutter.
- Shared sessions can reuse the same filters when created from a multitopic/random setup.

### 3. Per-topic done/wrong/not-done chart

This is primarily an analytics UI refinement, not a new data model.

Definitions:

- `done`: unique published questions in the topic with at least one review event by the current user.
- `wrong`: review attempts with rating `wrong` or `partial`; if the UI needs unique wrong questions later, add a separate field instead of changing existing semantics silently.
- `not done`: `totalQuestions - reviewedQuestions`.

Expected UI:

- Show a compact stacked bar per topic: done/correct-ish, wrong, not done.
- Keep numeric labels visible: total, done, wrong attempts, not done.
- Sort default should emphasize actionability: high wrong/problem score first, then many not-done, then total count.
- Keep the current text list as accessible supporting data.

Acceptance criteria:

- Uses real `/api/stats/topics` data.
- No new chart dependency unless there is a clear payoff; CSS bars are enough for v1.
- Empty state distinguishes "no published questions" from "no reviews yet" where practical.

### 4. Clusters with the largest number of questions

For web implementation, treat "cluster" as the existing study taxonomy grouping unless a separate cluster table/source is added.

Recommended v1 definition:

- A cluster is a topic branch or module-like grouping from `topics`/`modules`, with count of published questions mapped through `question_topic_map`.
- Show the largest clusters by `totalQuestions`.
- Include subject, module/path, published question count, reviewed count, wrong count, and not-done count.
- Link/action should start a simulation filtered to that cluster.

Open question for later planning:

- If the user means pipeline concept clusters from source material rather than web topics/modules, add/import a first-class cluster mapping before building this UI. Do not overload the Dexie `clusterSRStates` client-only table for server analytics.

Acceptance criteria:

- Provides top N high-volume areas, not just weak areas.
- Counts only active, published questions visible to normal users.
- Does not expose admin-only/unpublished cards.

### 5. Join shared session from web app

Existing backend support is present; the product gap is discoverability and route placement.

Expected behavior:

- A user can enter a shared session code from a visible web entry point, not only from the `/studio` sidebar.
- Candidate entry points: dashboard/home, dedicated `/study/shared/join`, and mobile study setup.
- On submit, call existing `POST /api/shared-sessions` with `{ code }`.
- Normalize code to uppercase and trim whitespace.
- On success, redirect to `/study/shared/<CODE>`.
- On 401, send to login or show login-required state.
- On 404/400, show inline error and keep the typed code.

Acceptance criteria:

- Existing `/studio` join flow remains working.
- New join UI is accessible, compact, and uses the calm Sbobby dashboard style.
- Route works on mobile viewport.

## Suggested Planning Split

1. Plan/implement mobile finish session first, because it is a narrow product gap and likely has backend support already close to ready.
2. Plan a shared filter-model update for random/multitopic simulation, with mobile UI as the main implementation target.
3. Plan stats improvements together: per-topic done/wrong/not-done chart plus largest clusters, because both use topic/module counts.
4. Plan shared-session join UX last or in parallel with random/multitopic UI if separate workers are available.

## References

- `components/mobile-study/MobileStudyApp.tsx`
- `app/api/study-sessions/[id]/route.ts`
- `app/api/questions/route.ts`
- `app/api/shared-sessions/route.ts`
- `components/studio/ExamStudioApp.tsx`
- `components/study/SharedStudyApp.tsx`
- `lib/exam/repository.ts`
- `lib/exam/types.ts`
