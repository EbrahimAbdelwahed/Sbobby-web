import { neon } from "@neondatabase/serverless";

import seed from "@/data/seed.json";
import type {
  Module,
  Question,
  QuestionExplanation,
  QuestionOption,
  QuestionView,
  Rating,
  ReliabilityLevel,
  ReviewEvent,
  ReviewStatus,
  SeedData,
  SourceChunk,
  SourceRef,
  StudySession,
  Subject,
  Topic,
} from "@/lib/exam/types";

type Row = Record<string, unknown>;
type TopicWithModule = Topic & { moduleTitle: string };

declare global {
  var __sbobbyDbReady: Promise<void> | undefined;
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for Sbobby Exam Flashcards");
  }
  return neon(url);
}

const sql = getSql();
const seedData = seed as SeedData;

function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUserId(rawUserId: string) {
  return rawUserId.trim().toLowerCase();
}

export async function ensureUser(input: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const userId = normalizeUserId(input.email || input.id);
  await ensureDb();
  await sql.query(
    `INSERT INTO users (id, email, name, image, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       image = EXCLUDED.image,
       updated_at = now()`,
    [userId, input.email, input.name ?? null, input.image ?? null],
  );
  return userId;
}

async function ensureSchema() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text UNIQUE NOT NULL,
      name text,
      image text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id text PRIMARY KEY,
      name text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modules (
      id text PRIMARY KEY,
      subject_id text NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title text NOT NULL,
      source_path text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id text PRIMARY KEY,
      title text NOT NULL,
      module_id text NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      subject text NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      source_path text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reliability_levels (
      id text PRIMARY KEY,
      code text UNIQUE NOT NULL,
      label text NOT NULL,
      description text NOT NULL,
      rank integer NOT NULL,
      is_publishable boolean NOT NULL,
      color_token text NOT NULL,
      icon_key text NOT NULL,
      is_active boolean NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_statuses (
      id text PRIMARY KEY,
      code text UNIQUE NOT NULL,
      label text NOT NULL,
      rank integer NOT NULL,
      is_final boolean NOT NULL,
      is_active boolean NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_chunks (
      id text PRIMARY KEY,
      subject text NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      source_kind text NOT NULL,
      source_path text NOT NULL,
      source_title text NOT NULL,
      lesson_id text NOT NULL,
      professor text,
      year text NOT NULL,
      heading_path jsonb NOT NULL,
      syllabus_topic_ids jsonb NOT NULL,
      needs_topic_review boolean NOT NULL,
      text_original text NOT NULL,
      text_clean text NOT NULL,
      text_for_embedding text NOT NULL,
      token_count integer NOT NULL,
      content_hash text NOT NULL,
      quality text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id text PRIMARY KEY,
      subject text NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      question_type text NOT NULL,
      question_text text NOT NULL,
      source_refs jsonb NOT NULL,
      exam_date text,
      needs_review boolean NOT NULL,
      raw_text text NOT NULL,
      needs_topic_review boolean NOT NULL,
      review_status_id text NOT NULL REFERENCES review_statuses(id),
      reliability_level_id text NOT NULL REFERENCES reliability_levels(id),
      is_active boolean NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_options (
      id text PRIMARY KEY,
      question_id text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      label text NOT NULL,
      text text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_topic_map (
      question_id text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      topic_id text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      PRIMARY KEY (question_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS question_explanations (
      id text PRIMARY KEY,
      question_id text UNIQUE NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      answer text NOT NULL,
      explanation_short text NOT NULL,
      rationale text NOT NULL,
      source_chunk_ids jsonb NOT NULL,
      evidence_status text NOT NULL,
      confidence double precision NOT NULL,
      warnings jsonb NOT NULL,
      model text NOT NULL,
      needs_human_review boolean NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at timestamptz NOT NULL,
      filters jsonb NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_events (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      session_id text REFERENCES study_sessions(id) ON DELETE SET NULL,
      rating text NOT NULL,
      created_at timestamptz NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_review ON questions(review_status_id, reliability_level_id);
    CREATE INDEX IF NOT EXISTS idx_review_events_user_question ON review_events(user_id, question_id);
  `;
  for (const statement of schemaSql.split(";").map((item) => item.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
}

async function seedIfEmpty() {
  const rows = (await sql.query(
    `SELECT
       (SELECT COUNT(*)::int FROM questions) AS questions,
       (SELECT COUNT(*)::int FROM source_chunks) AS chunks`,
  )) as Array<{ questions: number; chunks: number }>;
  if (
    (rows[0]?.questions ?? 0) >= seedData.questions.length &&
    (rows[0]?.chunks ?? 0) >= seedData.sourceChunks.length
  ) {
    return;
  }

  for (const subject of seedData.subjects) {
    await sql.query("INSERT INTO subjects (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [
      subject.id,
      subject.name,
    ]);
  }

  for (const moduleItem of seedData.modules) {
    await sql.query(
      `INSERT INTO modules (id, subject_id, title, source_path)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [moduleItem.id, moduleItem.subjectId, moduleItem.title, moduleItem.sourcePath],
    );
  }

  for (const topic of seedData.topics) {
    await sql.query(
      `INSERT INTO topics (id, title, module_id, subject, source_path)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [topic.id, topic.title, topic.module_id, topic.subject, topic.source_path],
    );
  }

  for (const level of seedData.reliabilityLevels) {
    await sql.query(
      `INSERT INTO reliability_levels
       (id, code, label, description, rank, is_publishable, color_token, icon_key, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        level.id,
        level.code,
        level.label,
        level.description,
        level.rank,
        level.isPublishable,
        level.colorToken,
        level.iconKey,
        level.isActive,
      ],
    );
  }

  for (const status of seedData.reviewStatuses) {
    await sql.query(
      `INSERT INTO review_statuses (id, code, label, rank, is_final, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [status.id, status.code, status.label, status.rank, status.isFinal, status.isActive],
    );
  }

  for (const chunk of seedData.sourceChunks) {
    await sql.query(
      `INSERT INTO source_chunks
       (id, subject, source_kind, source_path, source_title, lesson_id, professor, year,
        heading_path, syllabus_topic_ids, needs_topic_review, text_original, text_clean,
        text_for_embedding, token_count, content_hash, quality)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO NOTHING`,
      [
        chunk.id,
        chunk.subject,
        chunk.sourceKind,
        chunk.sourcePath,
        chunk.sourceTitle,
        chunk.lessonId,
        chunk.professor,
        chunk.year,
        JSON.stringify(chunk.headingPath),
        JSON.stringify(chunk.syllabusTopicIds),
        chunk.needsTopicReview,
        chunk.textOriginal,
        chunk.textClean,
        chunk.textForEmbedding,
        chunk.tokenCount,
        chunk.contentHash,
        chunk.quality,
      ],
    );
  }

  for (const question of seedData.questions) {
    await sql.query(
      `INSERT INTO questions
       (id, subject, question_type, question_text, source_refs, exam_date, needs_review, raw_text,
        needs_topic_review, review_status_id, reliability_level_id, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [
        question.id,
        question.subject,
        question.questionType,
        question.questionText,
        JSON.stringify(question.sourceRefs),
        question.examDate,
        question.needsReview,
        question.rawText,
        question.needsTopicReview,
        question.reviewStatusId,
        question.reliabilityLevelId,
        question.isActive,
      ],
    );

    for (const option of question.options) {
      await sql.query(
        `INSERT INTO question_options (id, question_id, label, text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [option.id, question.id, option.label, option.text],
      );
    }

    for (const topicId of question.topicIds) {
      await sql.query(
        `INSERT INTO question_topic_map (question_id, topic_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [question.id, topicId],
      );
    }
  }

  for (const explanation of seedData.questionExplanations) {
    await sql.query(
      `INSERT INTO question_explanations
       (id, question_id, answer, explanation_short, rationale, source_chunk_ids,
        evidence_status, confidence, warnings, model, needs_human_review)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        explanation.id,
        explanation.questionId,
        explanation.answer,
        explanation.explanationShort,
        explanation.rationale,
        JSON.stringify(explanation.sourceChunkIds),
        explanation.evidenceStatus,
        explanation.confidence,
        JSON.stringify(explanation.warnings),
        explanation.model,
        explanation.needsHumanReview,
      ],
    );
  }
}

export async function ensureDb() {
  if (!globalThis.__sbobbyDbReady) {
    globalThis.__sbobbyDbReady = (async () => {
      await ensureSchema();
      await seedIfEmpty();
    })();
  }
  return globalThis.__sbobbyDbReady;
}

function mapReliability(row: Row): ReliabilityLevel {
  return {
    id: String(row.id),
    code: String(row.code),
    label: String(row.label),
    description: String(row.description),
    rank: Number(row.rank),
    isPublishable: Boolean(row.is_publishable),
    colorToken: String(row.color_token),
    iconKey: String(row.icon_key),
    isActive: Boolean(row.is_active),
  };
}

function mapReviewStatus(row: Row): ReviewStatus {
  return {
    id: String(row.id),
    code: String(row.code),
    label: String(row.label),
    rank: Number(row.rank),
    isFinal: Boolean(row.is_final),
    isActive: Boolean(row.is_active),
  };
}

function mapSourceChunk(row: Row): SourceChunk {
  return {
    id: String(row.id),
    subject: String(row.subject),
    sourceKind: String(row.source_kind),
    sourcePath: String(row.source_path),
    sourceTitle: String(row.source_title),
    lessonId: String(row.lesson_id),
    professor: row.professor ? String(row.professor) : null,
    year: String(row.year),
    headingPath: json<string[]>(row.heading_path, []),
    syllabusTopicIds: json<string[]>(row.syllabus_topic_ids, []),
    needsTopicReview: Boolean(row.needs_topic_review),
    textOriginal: String(row.text_original),
    textClean: String(row.text_clean),
    textForEmbedding: String(row.text_for_embedding),
    tokenCount: Number(row.token_count),
    contentHash: String(row.content_hash),
    quality: String(row.quality),
  };
}

function mapQuestion(row: Row): Question {
  return {
    id: String(row.id),
    subject: String(row.subject),
    questionType: String(row.question_type) === "multiple_choice" ? "multiple_choice" : "open",
    questionText: String(row.question_text),
    options: json<QuestionOption[]>(row.options, []),
    sourceRefs: json<SourceRef[]>(row.source_refs, []),
    examDate: row.exam_date ? String(row.exam_date) : null,
    needsReview: Boolean(row.needs_review),
    rawText: String(row.raw_text),
    topicIds: json<string[]>(row.topic_ids, []),
    needsTopicReview: Boolean(row.needs_topic_review),
    reviewStatusId: String(row.review_status_id),
    reliabilityLevelId: String(row.reliability_level_id),
    isActive: Boolean(row.is_active),
  };
}

function mapExplanation(row: Row | null | undefined): QuestionExplanation | null {
  if (!row?.explanation_id) return null;
  return {
    id: String(row.explanation_id),
    questionId: String(row.id),
    answer: String(row.answer),
    explanationShort: String(row.explanation_short),
    rationale: String(row.rationale),
    sourceChunkIds: json<string[]>(row.source_chunk_ids, []),
    evidenceStatus: String(row.evidence_status) as QuestionExplanation["evidenceStatus"],
    confidence: Number(row.confidence),
    warnings: json<string[]>(row.warnings, []),
    model: String(row.model),
    needsHumanReview: Boolean(row.needs_human_review),
  };
}

async function questionRows(whereSql: string, params: unknown[], limit = 100) {
  await ensureDb();
  return (await sql.query(
    `SELECT
       q.*,
       COALESCE(
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', qo.id,
           'questionId', qo.question_id,
           'label', qo.label,
           'text', qo.text
         )) FILTER (WHERE qo.id IS NOT NULL),
         '[]'::jsonb
       ) AS options,
       COALESCE(jsonb_agg(DISTINCT qtm.topic_id) FILTER (WHERE qtm.topic_id IS NOT NULL), '[]'::jsonb) AS topic_ids,
       qe.id AS explanation_id,
       qe.answer,
       qe.explanation_short,
       qe.rationale,
       qe.source_chunk_ids,
       qe.evidence_status,
       qe.confidence,
       qe.warnings,
       qe.model,
       qe.needs_human_review
     FROM questions q
     LEFT JOIN question_options qo ON qo.question_id = q.id
     LEFT JOIN question_topic_map qtm ON qtm.question_id = q.id
     LEFT JOIN question_explanations qe ON qe.question_id = q.id
     ${whereSql}
     GROUP BY q.id, qe.id
     ORDER BY q.subject, q.question_text
     LIMIT $${params.length + 1}`,
    [...params, limit],
  )) as Row[];
}

async function getQuestionStatsMap(userId: string) {
  await ensureDb();
  const rows = (await sql.query(
    `SELECT
       question_id,
       COUNT(*)::int AS attempts,
       COUNT(*) FILTER (WHERE rating IN ('wrong', 'partial'))::int AS wrong,
       COUNT(*) FILTER (WHERE rating IN ('correct', 'easy'))::int AS correct,
       (array_agg(rating ORDER BY created_at DESC))[1] AS last_rating
     FROM review_events
     WHERE user_id = $1
     GROUP BY question_id`,
    [userId],
  )) as Row[];

  return new Map(
    rows.map((row) => [
      String(row.question_id),
      {
        attempts: Number(row.attempts),
        wrong: Number(row.wrong),
        correct: Number(row.correct),
        lastRating: row.last_rating ? (String(row.last_rating) as Rating) : null,
      },
    ]),
  );
}

async function getQuestionViews(rows: Row[], userId: string): Promise<QuestionView[]> {
  const [subjects, topics, reliabilityLevels, reviewStatuses, statsMap] = await Promise.all([
    getSubjects(),
    getTopics(),
    getReliabilityLevels(),
    getReviewStatuses(),
    getQuestionStatsMap(userId),
  ]);
  const subjectMap = new Map(subjects.map((item) => [item.id, item]));
  const topicMap = new Map(topics.map((item) => [item.id, item]));
  const reliabilityMap = new Map(reliabilityLevels.map((item) => [item.id, item]));
  const reviewStatusMap = new Map(reviewStatuses.map((item) => [item.id, item]));
  const chunkIds = Array.from(
    new Set(
      rows.flatMap((row) => mapExplanation(row)?.sourceChunkIds ?? []),
    ),
  );
  const chunkMap = await getSourceChunkMap(chunkIds);

  return rows.map((row) => {
    const question = mapQuestion(row);
    const explanation = mapExplanation(row);
    const sourceChunks = (explanation?.sourceChunkIds ?? [])
      .map((id) => chunkMap.get(id))
      .filter((chunk): chunk is SourceChunk => Boolean(chunk));
    const stats = statsMap.get(question.id) ?? { attempts: 0, wrong: 0, correct: 0, lastRating: null };

    return {
      ...question,
      subjectLabel: subjectMap.get(question.subject)?.name ?? question.subject,
      topics: question.topicIds
        .map((topicId) => topicMap.get(topicId))
        .filter((topic): topic is TopicWithModule => Boolean(topic)),
      reviewStatus: reviewStatusMap.get(question.reviewStatusId) ?? reviewStatuses[0],
      reliabilityLevel: reliabilityMap.get(question.reliabilityLevelId) ?? reliabilityLevels[0],
      explanation,
      sourceChunks,
      userStats: stats,
    };
  });
}

async function getSourceChunkMap(ids: string[]) {
  await ensureDb();
  if (ids.length === 0) return new Map<string, SourceChunk>();
  const rows = (await sql.query("SELECT * FROM source_chunks WHERE id = ANY($1)", [ids])) as Row[];
  return new Map(rows.map((row) => [String(row.id), mapSourceChunk(row)]));
}

export async function getSubjects(): Promise<Subject[]> {
  await ensureDb();
  return (await sql.query("SELECT id, name FROM subjects ORDER BY name")) as Subject[];
}

export async function getModules(): Promise<Module[]> {
  await ensureDb();
  const rows = (await sql.query(
    "SELECT id, subject_id, title, source_path FROM modules ORDER BY subject_id, title",
  )) as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    subjectId: String(row.subject_id),
    title: String(row.title),
    sourcePath: String(row.source_path),
  }));
}

export async function getTopics(subject?: string | null): Promise<TopicWithModule[]> {
  await ensureDb();
  const params: unknown[] = [];
  const where = subject ? "WHERE t.subject = $1" : "";
  if (subject) params.push(subject);
  const rows = (await sql.query(
    `SELECT t.id, t.title, t.module_id, t.subject, t.source_path, m.title AS module_title
     FROM topics t
     JOIN modules m ON m.id = t.module_id
     ${where}
     ORDER BY t.subject, m.title, t.title`,
    params,
  )) as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    module_id: String(row.module_id),
    subject: String(row.subject),
    source_path: String(row.source_path),
    moduleTitle: String(row.module_title),
  }));
}

export async function getReliabilityLevels(): Promise<ReliabilityLevel[]> {
  await ensureDb();
  const rows = (await sql.query("SELECT * FROM reliability_levels WHERE is_active = true ORDER BY rank")) as Row[];
  return rows.map(mapReliability);
}

export async function getReviewStatuses(): Promise<ReviewStatus[]> {
  await ensureDb();
  const rows = (await sql.query("SELECT * FROM review_statuses WHERE is_active = true ORDER BY rank")) as Row[];
  return rows.map(mapReviewStatus);
}

export async function getQuestions(filters: {
  userId: string;
  subject?: string | null;
  topic?: string | null;
  reliability?: string | null;
  wrongBefore?: boolean;
  includeReview?: boolean;
  limit?: number;
}): Promise<QuestionView[]> {
  const params: unknown[] = [];
  const clauses = ["q.is_active = true"];
  if (!filters.includeReview) {
    clauses.push(
      "EXISTS (SELECT 1 FROM reliability_levels rl WHERE rl.id = q.reliability_level_id AND rl.is_publishable = true)",
      "EXISTS (SELECT 1 FROM review_statuses rs WHERE rs.id = q.review_status_id AND rs.is_final = true)",
    );
  }
  if (filters.subject) {
    params.push(filters.subject);
    clauses.push(`q.subject = $${params.length}`);
  }
  if (filters.topic) {
    params.push(filters.topic);
    clauses.push(`EXISTS (SELECT 1 FROM question_topic_map qtf WHERE qtf.question_id = q.id AND qtf.topic_id = $${params.length})`);
  }
  if (filters.reliability) {
    params.push(filters.reliability);
    clauses.push(`q.reliability_level_id = $${params.length}`);
  }
  if (filters.wrongBefore) {
    params.push(filters.userId);
    clauses.push(`EXISTS (
      SELECT 1 FROM review_events re
      WHERE re.question_id = q.id AND re.user_id = $${params.length} AND re.rating IN ('wrong', 'partial')
    )`);
  }

  const rows = await questionRows(`WHERE ${clauses.join(" AND ")}`, params, filters.limit ?? 100);
  return getQuestionViews(rows, filters.userId);
}

export async function createStudySession(filters: StudySession["filters"], userId: string): Promise<StudySession> {
  await ensureDb();
  const session: StudySession = {
    id: makeId("session"),
    userId,
    startedAt: nowIso(),
    filters,
  };
  await sql.query(
    "INSERT INTO study_sessions (id, user_id, started_at, filters) VALUES ($1, $2, $3, $4::jsonb)",
    [session.id, session.userId, session.startedAt, JSON.stringify(session.filters)],
  );
  return session;
}

export async function createReviewEvent(input: {
  userId: string;
  questionId: string;
  sessionId?: string | null;
  rating: Rating;
}): Promise<ReviewEvent> {
  await ensureDb();
  const event: ReviewEvent = {
    id: makeId("event"),
    userId: input.userId,
    questionId: input.questionId,
    sessionId: input.sessionId ?? null,
    rating: input.rating,
    createdAt: nowIso(),
  };
  await sql.query(
    `INSERT INTO review_events (id, user_id, question_id, session_id, rating, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [event.id, event.userId, event.questionId, event.sessionId, event.rating, event.createdAt],
  );
  return event;
}

export async function getReviewQueue(userId: string): Promise<QuestionView[]> {
  const rows = await questionRows(
    `WHERE q.review_status_id <> 'approved'
       OR q.needs_review = true
       OR EXISTS (
         SELECT 1 FROM question_explanations qex
         WHERE qex.question_id = q.id AND qex.needs_human_review = true
       )`,
    [],
    100,
  );
  return getQuestionViews(rows, userId);
}

export async function updateQuestionReview(
  questionId: string,
  patch: {
    reviewStatusId?: string;
    reliabilityLevelId?: string;
    answer?: string;
    explanationShort?: string;
  },
  userId: string,
): Promise<QuestionView | null> {
  await ensureDb();
  const rows = (await sql.query("SELECT id FROM questions WHERE id = $1", [questionId])) as Row[];
  if (!rows.length) {
    return null;
  }

  if (patch.reviewStatusId || patch.reliabilityLevelId) {
    await sql.query(
      `UPDATE questions SET
         review_status_id = COALESCE($2, review_status_id),
         reliability_level_id = COALESCE($3, reliability_level_id),
         needs_review = CASE WHEN $2 = 'approved' THEN false ELSE needs_review END
       WHERE id = $1`,
      [questionId, patch.reviewStatusId ?? null, patch.reliabilityLevelId ?? null],
    );
  }

  if (patch.answer || patch.explanationShort || patch.reviewStatusId === "approved") {
    await sql.query(
      `UPDATE question_explanations SET
         answer = COALESCE($2, answer),
         explanation_short = COALESCE($3, explanation_short),
         needs_human_review = CASE WHEN $4 = 'approved' THEN false ELSE needs_human_review END,
         warnings = CASE
           WHEN $4 = 'approved' THEN COALESCE((
             SELECT jsonb_agg(value)
             FROM jsonb_array_elements_text(warnings) AS value
             WHERE value <> 'human_review_required'
           ), '[]'::jsonb)
           ELSE warnings
         END
       WHERE question_id = $1`,
      [questionId, patch.answer ?? null, patch.explanationShort ?? null, patch.reviewStatusId ?? null],
    );
  }

  const updatedRows = await questionRows("WHERE q.id = $1", [questionId], 1);
  const [view] = await getQuestionViews(updatedRows, userId);
  return view ?? null;
}

export async function getTopicStats(userId: string) {
  await ensureDb();
  return (await sql.query(
    `SELECT
       t.id,
       t.title,
       t.subject,
       m.title AS "moduleTitle",
       COUNT(re.id)::int AS attempts,
       COUNT(re.id) FILTER (WHERE re.rating IN ('wrong', 'partial'))::int AS wrong,
       COUNT(re.id) FILTER (WHERE re.rating IN ('correct', 'easy'))::int AS correct,
       (COUNT(re.id) FILTER (WHERE re.rating IN ('wrong', 'partial'))::float
        - COUNT(re.id) FILTER (WHERE re.rating IN ('correct', 'easy'))::float * 0.35) AS "problemScore"
     FROM topics t
     JOIN modules m ON m.id = t.module_id
     JOIN question_topic_map qtm ON qtm.topic_id = t.id
     JOIN review_events re ON re.question_id = qtm.question_id AND re.user_id = $1
     GROUP BY t.id, m.title
     HAVING COUNT(re.id) > 0
     ORDER BY "problemScore" DESC
     LIMIT 12`,
    [userId],
  )) as Array<{
    id: string;
    title: string;
    subject: string;
    moduleTitle: string;
    attempts: number;
    wrong: number;
    correct: number;
    problemScore: number;
  }>;
}

export async function getQuestionStats(userId: string) {
  await ensureDb();
  return (await sql.query(
    `SELECT
       q.id,
       q.question_text AS "questionText",
       q.subject,
       COUNT(re.id)::int AS attempts,
       COUNT(re.id) FILTER (WHERE re.rating IN ('wrong', 'partial'))::int AS wrong,
       COUNT(re.id) FILTER (WHERE re.rating IN ('correct', 'easy'))::int AS correct,
       (array_agg(re.rating ORDER BY re.created_at DESC))[1] AS "lastRating",
       (COUNT(re.id) FILTER (WHERE re.rating IN ('wrong', 'partial'))::float
        - COUNT(re.id) FILTER (WHERE re.rating IN ('correct', 'easy'))::float * 0.35) AS "problemScore"
     FROM questions q
     JOIN review_events re ON re.question_id = q.id AND re.user_id = $1
     GROUP BY q.id
     HAVING COUNT(re.id) > 0
     ORDER BY "problemScore" DESC
     LIMIT 12`,
    [userId],
  )) as Array<{
    id: string;
    questionText: string;
    subject: string;
    attempts: number;
    wrong: number;
    correct: number;
    lastRating: Rating | null;
    problemScore: number;
  }>;
}

export async function getDatabaseStatus() {
  try {
    await ensureDb();
    const rows = (await sql.query(
      `SELECT
         (SELECT COUNT(*)::int FROM questions) AS questions,
         (SELECT COUNT(*)::int FROM source_chunks) AS "sourceChunks",
         (SELECT COUNT(*)::int FROM review_events) AS "reviewEvents"`,
    )) as Array<{ questions: number; sourceChunks: number; reviewEvents: number }>;
    return {
      mode: "postgres",
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      seedGeneratedBy: seedData.generatedBy,
      counts: rows[0] ?? { questions: 0, sourceChunks: 0, reviewEvents: 0 },
    };
  } catch (error) {
    return {
      mode: "postgres_error",
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
