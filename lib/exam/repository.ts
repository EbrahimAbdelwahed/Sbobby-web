import { neon } from "@neondatabase/serverless";

import seed from "@/data/seed.json";
import type {
  Module,
  ChatMessage,
  ChatRole,
  ChatThread,
  PublicationStatus,
  Question,
  QuestionExplanation,
  QuestionOption,
  QuestionView,
  Rating,
  ReliabilityLevel,
  ReviewEvent,
  ReviewStatus,
  SeedData,
  SharedStudyAnswer,
  SharedStudyAssignment,
  SharedStudyParticipant,
  SharedStudySession,
  SharedStudyState,
  SourceChunk,
  SourceRef,
  StudySession,
  Subject,
  TopicTreeNode,
  TopicWithModule,
} from "@/lib/exam/types";

type Row = Record<string, unknown>;

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
const seedData = seed as unknown as SeedData;

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

function makeSessionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function normalizeUserId(rawUserId: string) {
  return rawUserId.trim().toLowerCase();
}

async function backfillTopicTaxonomy() {
  await sql.query(`
    WITH ordered_topics AS (
      SELECT
        t.id,
        row_number() OVER (PARTITION BY t.module_id ORDER BY t.title, t.id)::int AS display_order,
        jsonb_build_array(m.title, t.title) AS path
      FROM topics t
      JOIN modules m ON m.id = t.module_id
    )
    UPDATE topics t
    SET
      level = COALESCE(t.level, 2),
      display_order = CASE WHEN t.display_order = 0 THEN ordered_topics.display_order ELSE t.display_order END,
      path = CASE WHEN t.path = '[]'::jsonb THEN ordered_topics.path ELSE t.path END
    FROM ordered_topics
    WHERE ordered_topics.id = t.id
  `);
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

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, role)
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
      source_path text NOT NULL,
      parent_topic_id text REFERENCES topics(id) ON DELETE SET NULL,
      level integer NOT NULL DEFAULT 2,
      display_order integer NOT NULL DEFAULT 0,
      path jsonb NOT NULL DEFAULT '[]'::jsonb
    );

    ALTER TABLE topics ADD COLUMN IF NOT EXISTS parent_topic_id text REFERENCES topics(id) ON DELETE SET NULL;
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 2;
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS path jsonb NOT NULL DEFAULT '[]'::jsonb;

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
      publication_status text NOT NULL DEFAULT 'unpublished',
      published_at timestamptz,
      published_by text,
      admin_note text,
      is_active boolean NOT NULL
    );

    ALTER TABLE questions ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'unpublished';
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS published_at timestamptz;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS published_by text;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS admin_note text;

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

    CREATE TABLE IF NOT EXISTS shared_study_sessions (
      id text PRIMARY KEY,
      code text UNIQUE NOT NULL,
      created_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'open',
      filters jsonb NOT NULL,
      question_ids jsonb NOT NULL,
      group_review_enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      started_at timestamptz,
      completed_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS shared_study_participants (
      session_id text NOT NULL REFERENCES shared_study_sessions(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name text NOT NULL,
      joined_at timestamptz NOT NULL DEFAULT now(),
      left_at timestamptz,
      PRIMARY KEY (session_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS shared_study_answers (
      id text PRIMARY KEY,
      session_id text NOT NULL REFERENCES shared_study_sessions(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      rating text NOT NULL,
      selected_option_id text,
      is_correct boolean,
      answered_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (session_id, user_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id text NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id text PRIMARY KEY,
      thread_id text NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      citations jsonb NOT NULL DEFAULT '[]'::jsonb,
      model text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject);
    CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_topic_id);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_review ON questions(review_status_id, reliability_level_id);
    CREATE INDEX IF NOT EXISTS idx_questions_publication ON questions(publication_status, is_active);
    CREATE INDEX IF NOT EXISTS idx_review_events_user_question ON review_events(user_id, question_id);
    CREATE INDEX IF NOT EXISTS idx_shared_answers_session_question ON shared_study_answers(session_id, question_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
  `;
  for (const statement of schemaSql.split(";").map((item) => item.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
  await backfillTopicTaxonomy();
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
    const explanation = seedData.questionExplanations.find((item) => item.questionId === question.id);
    const seedPublished = Boolean(
      explanation &&
        explanation.evidenceStatus === "supported" &&
        explanation.sourceChunkIds.length > 0 &&
        !explanation.needsHumanReview &&
        question.reviewStatusId === "approved",
    );
    await sql.query(
      `INSERT INTO questions
       (id, subject, question_type, question_text, source_refs, exam_date, needs_review, raw_text,
        needs_topic_review, review_status_id, reliability_level_id, publication_status, published_at, published_by, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        seedPublished ? "published" : "unpublished",
        seedPublished ? nowIso() : null,
        seedPublished ? "seed" : null,
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
      await backfillTopicTaxonomy();
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

function mapTopic(row: Row): TopicWithModule {
  const moduleTitle = String(row.module_title);
  return {
    id: String(row.id),
    title: String(row.title),
    module_id: String(row.module_id),
    subject: String(row.subject),
    source_path: String(row.source_path),
    parentTopicId: row.parent_topic_id ? String(row.parent_topic_id) : null,
    level: Number(row.level ?? 2),
    displayOrder: Number(row.display_order ?? 0),
    path: json<string[]>(row.path, [moduleTitle, String(row.title)]),
    questionCount: Number(row.question_count ?? 0),
    moduleTitle,
  };
}

function countQuestionsInTree(node: TopicTreeNode): number {
  if (node.children.length === 0) {
    return node.questionCount;
  }
  node.children.sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
  const childCount = node.children.reduce((total, child) => total + countQuestionsInTree(child), 0);
  node.questionCount += childCount;
  return node.questionCount;
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
    publicationStatus: String(row.publication_status ?? "unpublished") as PublicationStatus,
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    publishedBy: row.published_by ? String(row.published_by) : null,
    adminNote: row.admin_note ? String(row.admin_note) : null,
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

function publishedQuestionSql(alias = "q", explanationAlias = "qe") {
  return [
    `${alias}.is_active = true`,
    `${alias}.publication_status = 'published'`,
    `${explanationAlias}.id IS NOT NULL`,
    `${explanationAlias}.evidence_status = 'supported'`,
    `jsonb_array_length(${explanationAlias}.source_chunk_ids) > 0`,
    `EXISTS (
      SELECT 1 FROM source_chunks sc
      WHERE sc.id IN (SELECT jsonb_array_elements_text(${explanationAlias}.source_chunk_ids))
    )`,
  ];
}

export async function userHasRole(userId: string, role: "admin") {
  await ensureDb();
  const rows = (await sql.query("SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2 LIMIT 1", [
    normalizeUserId(userId),
    role,
  ])) as Row[];
  return rows.length > 0;
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
    `SELECT
       t.id,
       t.title,
       t.module_id,
       t.subject,
       t.source_path,
       t.parent_topic_id,
       t.level,
       t.display_order,
       t.path,
       m.title AS module_title,
       COUNT(DISTINCT qtm.question_id)::int AS question_count
     FROM topics t
     JOIN modules m ON m.id = t.module_id
     LEFT JOIN question_topic_map qtm ON qtm.topic_id = t.id
     ${where}
     GROUP BY t.id, m.title
     ORDER BY t.subject, m.title, t.display_order, t.title`,
    params,
  )) as Row[];
  return rows.map(mapTopic);
}

export async function getTopicTree(subject?: string | null): Promise<TopicTreeNode[]> {
  const [modules, topics] = await Promise.all([getModules(), getTopics(subject)]);
  const topicNodes = new Map<string, TopicTreeNode>();
  const moduleNodes = new Map<string, TopicTreeNode>();

  for (const topic of topics) {
    topicNodes.set(topic.id, {
      ...topic,
      kind: "topic",
      children: [],
    });
  }

  for (const topic of topics) {
    const node = topicNodes.get(topic.id);
    if (!node) continue;
    if (topic.parentTopicId && topicNodes.has(topic.parentTopicId)) {
      topicNodes.get(topic.parentTopicId)?.children.push(node);
      continue;
    }

    const moduleItem = modules.find((item) => item.id === topic.module_id);
    if (!moduleItem) continue;
    let moduleNode = moduleNodes.get(moduleItem.id);
    if (!moduleNode) {
      moduleNode = {
        id: moduleItem.id,
        title: moduleItem.title,
        subject: moduleItem.subjectId,
        source_path: moduleItem.sourcePath,
        module_id: moduleItem.id,
        moduleTitle: moduleItem.title,
        parentTopicId: null,
        level: 1,
        displayOrder: moduleNodes.size + 1,
        path: [moduleItem.title],
        questionCount: 0,
        children: [],
        kind: "module",
      };
      moduleNodes.set(moduleItem.id, moduleNode);
    }
    moduleNode.children.push(node);
  }

  for (const moduleNode of moduleNodes.values()) {
    moduleNode.children.sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
    moduleNode.questionCount = countQuestionsInTree(moduleNode);
  }

  return Array.from(moduleNodes.values())
    .filter((moduleNode) => !subject || moduleNode.subject === subject)
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
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

async function getTopicBranchIds(topicOrModuleId: string) {
  await ensureDb();
  const topicRows = (await sql.query(
    `WITH RECURSIVE topic_branch AS (
       SELECT id FROM topics WHERE id = $1
       UNION ALL
       SELECT child.id
       FROM topics child
       JOIN topic_branch parent ON child.parent_topic_id = parent.id
     )
     SELECT id FROM topic_branch`,
    [topicOrModuleId],
  )) as Row[];
  if (topicRows.length > 0) {
    return topicRows.map((row) => String(row.id));
  }

  const moduleRows = (await sql.query("SELECT id FROM topics WHERE module_id = $1", [topicOrModuleId])) as Row[];
  return moduleRows.map((row) => String(row.id));
}

export async function getQuestions(filters: {
  userId: string;
  subject?: string | null;
  topic?: string | null;
  topics?: string[];
  wrongBefore?: boolean;
  includeReview?: boolean;
  limit?: number;
  order?: "random" | "ordered";
}): Promise<QuestionView[]> {
  const params: unknown[] = [];
  const clauses = ["q.is_active = true"];
  if (!filters.includeReview) {
    clauses.push(...publishedQuestionSql("q", "qe").slice(1));
  }
  if (filters.subject) {
    params.push(filters.subject);
    clauses.push(`q.subject = $${params.length}`);
  }
  const topicFilters = [...(filters.topic ? [filters.topic] : []), ...(filters.topics ?? [])]
    .map((topic) => topic.trim())
    .filter(Boolean);
  if (topicFilters.length > 0) {
    const topicIds = Array.from(
      new Set((await Promise.all(topicFilters.map((topic) => getTopicBranchIds(topic)))).flat()),
    );
    if (topicIds.length === 0) {
      clauses.push("false");
    } else {
      params.push(topicIds);
      clauses.push(`EXISTS (
        SELECT 1 FROM question_topic_map qtf
        WHERE qtf.question_id = q.id AND qtf.topic_id = ANY($${params.length}::text[])
      )`);
    }
  }
  if (filters.wrongBefore) {
    params.push(filters.userId);
    clauses.push(`EXISTS (
      SELECT 1 FROM review_events re
      WHERE re.question_id = q.id AND re.user_id = $${params.length} AND re.rating IN ('wrong', 'partial')
    )`);
  }

  const rows = await questionRows(`WHERE ${clauses.join(" AND ")}`, params, filters.limit ?? 100);
  if (filters.order === "random") {
    rows.sort(() => Math.random() - 0.5);
  }
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

export async function canAccessQuestion(questionId: string, isAdmin = false) {
  await ensureDb();
  const clauses = isAdmin ? ["q.id = $1"] : ["q.id = $1", ...publishedQuestionSql("q", "qe")];
  const rows = (await sql.query(
    `SELECT q.id
     FROM questions q
     LEFT JOIN question_explanations qe ON qe.question_id = q.id
     WHERE ${clauses.join(" AND ")}
     LIMIT 1`,
    [questionId],
  )) as Row[];
  return rows.length > 0;
}

export async function createReviewEvent(input: {
  userId: string;
  questionId: string;
  sessionId?: string | null;
  rating: Rating;
  allowUnpublished?: boolean;
}): Promise<ReviewEvent> {
  await ensureDb();
  if (!input.allowUnpublished && !(await canAccessQuestion(input.questionId))) {
    throw new Error("Question is not available");
  }
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
    `WHERE q.publication_status <> 'published'
       OR q.review_status_id <> 'approved'
       OR q.needs_review = true
       OR EXISTS (
         SELECT 1 FROM question_explanations qex
         WHERE qex.question_id = q.id
           AND (
             qex.needs_human_review = true
             OR qex.evidence_status <> 'supported'
             OR jsonb_array_length(qex.source_chunk_ids) = 0
           )
       )`,
    [],
    200,
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
    rationale?: string;
    evidenceStatus?: QuestionExplanation["evidenceStatus"];
    confidence?: number;
    warnings?: string[];
    needsHumanReview?: boolean;
    sourceChunkIds?: string[];
    publicationStatus?: PublicationStatus;
    adminNote?: string | null;
  },
  userId: string,
): Promise<QuestionView | null> {
  await ensureDb();
  const rows = (await sql.query("SELECT id FROM questions WHERE id = $1", [questionId])) as Row[];
  if (!rows.length) {
    return null;
  }

  if (patch.reviewStatusId || patch.reliabilityLevelId || patch.publicationStatus || patch.adminNote !== undefined) {
    await sql.query(
      `UPDATE questions SET
         review_status_id = COALESCE($2, review_status_id),
         reliability_level_id = COALESCE($3, reliability_level_id),
         publication_status = COALESCE($4, publication_status),
         published_at = CASE
           WHEN $4 = 'published' THEN COALESCE(published_at, now())
           WHEN $4 IS NOT NULL AND $4 <> 'published' THEN NULL
           ELSE published_at
         END,
         published_by = CASE
           WHEN $4 = 'published' THEN $5
           WHEN $4 IS NOT NULL AND $4 <> 'published' THEN NULL
           ELSE published_by
         END,
         admin_note = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE admin_note END,
         needs_review = CASE
           WHEN $2 = 'approved' OR $4 = 'published' THEN false
           WHEN $4 IN ('needs_repair', 'unpublished') THEN true
           ELSE needs_review
         END
       WHERE id = $1`,
      [
        questionId,
        patch.reviewStatusId ?? null,
        patch.reliabilityLevelId ?? null,
        patch.publicationStatus ?? null,
        normalizeUserId(userId),
        patch.adminNote ?? null,
      ],
    );
  }

  const shouldUpdateExplanation =
    patch.answer !== undefined ||
    patch.explanationShort !== undefined ||
    patch.rationale !== undefined ||
    patch.evidenceStatus !== undefined ||
    patch.confidence !== undefined ||
    patch.warnings !== undefined ||
    patch.needsHumanReview !== undefined ||
    patch.sourceChunkIds !== undefined ||
    patch.reviewStatusId === "approved";

  if (shouldUpdateExplanation) {
    await sql.query(
      `UPDATE question_explanations SET
         answer = COALESCE($2, answer),
         explanation_short = COALESCE($3, explanation_short),
         rationale = COALESCE($4, rationale),
         evidence_status = COALESCE($5, evidence_status),
         confidence = COALESCE($6, confidence),
         source_chunk_ids = CASE WHEN $10::jsonb IS NOT NULL THEN $10::jsonb ELSE source_chunk_ids END,
         warnings = CASE
           WHEN $7::jsonb IS NOT NULL THEN $7::jsonb
           WHEN $9 = 'approved' THEN COALESCE((
             SELECT jsonb_agg(value)
             FROM jsonb_array_elements_text(warnings) AS value
             WHERE value <> 'human_review_required'
           ), '[]'::jsonb)
           ELSE warnings
         END,
         needs_human_review = CASE
           WHEN $8::boolean IS NOT NULL THEN $8::boolean
           WHEN $9 = 'approved' THEN false
           ELSE needs_human_review
         END
       WHERE question_id = $1`,
      [
        questionId,
        patch.answer ?? null,
        patch.explanationShort ?? null,
        patch.rationale ?? null,
        patch.evidenceStatus ?? null,
        patch.confidence ?? null,
        patch.warnings !== undefined ? JSON.stringify(patch.warnings) : null,
        patch.needsHumanReview ?? null,
        patch.reviewStatusId ?? null,
        patch.sourceChunkIds !== undefined ? JSON.stringify(patch.sourceChunkIds) : null,
      ],
    );
  }

  const updatedRows = await questionRows("WHERE q.id = $1", [questionId], 1);
  const [view] = await getQuestionViews(updatedRows, userId);
  return view ?? null;
}

function mapSharedSession(row: Row): SharedStudySession {
  return {
    id: String(row.id),
    code: String(row.code),
    createdBy: String(row.created_by),
    status: String(row.status) as SharedStudySession["status"],
    filters: json<StudySession["filters"]>(row.filters, {}),
    questionIds: json<string[]>(row.question_ids, []),
    groupReviewEnabled: Boolean(row.group_review_enabled),
    createdAt: new Date(String(row.created_at)).toISOString(),
    startedAt: row.started_at ? new Date(String(row.started_at)).toISOString() : null,
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
  };
}

function mapSharedParticipant(row: Row): SharedStudyParticipant {
  return {
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    displayName: String(row.display_name),
    joinedAt: new Date(String(row.joined_at)).toISOString(),
    leftAt: row.left_at ? new Date(String(row.left_at)).toISOString() : null,
  };
}

function mapSharedAnswer(row: Row): SharedStudyAnswer {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    questionId: String(row.question_id),
    rating: String(row.rating) as Rating,
    selectedOptionId: row.selected_option_id ? String(row.selected_option_id) : null,
    isCorrect: row.is_correct == null ? null : Boolean(row.is_correct),
    answeredAt: new Date(String(row.answered_at)).toISOString(),
  };
}

async function getQuestionViewsByIds(questionIds: string[], userId: string) {
  if (questionIds.length === 0) return [];
  const rows = await questionRows(
    `WHERE q.id = ANY($1::text[]) AND ${publishedQuestionSql("q", "qe").join(" AND ")}`,
    [questionIds],
    questionIds.length,
  );
  const order = new Map(questionIds.map((id, index) => [id, index]));
  return (await getQuestionViews(rows, userId)).sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

export async function getQuestionById(questionId: string, userId: string, isAdmin = false) {
  const clauses = isAdmin ? ["q.id = $1"] : ["q.id = $1", ...publishedQuestionSql("q", "qe")];
  const rows = await questionRows(`WHERE ${clauses.join(" AND ")}`, [questionId], 1);
  const [question] = await getQuestionViews(rows, userId);
  return question ?? null;
}

export async function createSharedStudySession(input: {
  userId: string;
  displayName: string;
  filters: StudySession["filters"];
  groupReviewEnabled: boolean;
}) {
  await ensureDb();
  const limit = Math.max(1, Math.min(100, Number(input.filters.limit ?? 20)));
  const questions = await getQuestions({
    userId: input.userId,
    subject: input.filters.subject,
    topics: input.filters.topics ?? (input.filters.topic ? input.filters.topic.split(",") : []),
    wrongBefore: input.filters.wrongBefore,
    limit,
    order: input.filters.order ?? "random",
  });
  if (questions.length === 0) {
    throw new Error("No published questions match the selected filters");
  }

  let code = makeSessionCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = (await sql.query("SELECT 1 FROM shared_study_sessions WHERE code = $1", [code])) as Row[];
    if (!existing.length) break;
    code = makeSessionCode();
  }

  const session: SharedStudySession = {
    id: makeId("shared"),
    code,
    createdBy: normalizeUserId(input.userId),
    status: "open",
    filters: { ...input.filters, limit, order: input.filters.order ?? "random" },
    questionIds: questions.map((question) => question.id),
    groupReviewEnabled: input.groupReviewEnabled,
    createdAt: nowIso(),
    startedAt: null,
    completedAt: null,
  };

  await sql.query(
    `INSERT INTO shared_study_sessions
       (id, code, created_by, status, filters, question_ids, group_review_enabled, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
    [
      session.id,
      session.code,
      session.createdBy,
      session.status,
      JSON.stringify(session.filters),
      JSON.stringify(session.questionIds),
      session.groupReviewEnabled,
      session.createdAt,
    ],
  );
  await joinSharedStudySession(code, input.userId, input.displayName);
  return session;
}

export async function joinSharedStudySession(code: string, userId: string, displayName: string) {
  await ensureDb();
  const sessionRows = (await sql.query(
    "SELECT * FROM shared_study_sessions WHERE code = $1 AND status <> 'archived' LIMIT 1",
    [code.trim().toUpperCase()],
  )) as Row[];
  if (!sessionRows.length) return null;
  const session = mapSharedSession(sessionRows[0]);
  await sql.query(
    `INSERT INTO shared_study_participants (session_id, user_id, display_name, joined_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (session_id, user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       left_at = NULL`,
    [session.id, normalizeUserId(userId), displayName || normalizeUserId(userId)],
  );
  return session;
}

export async function getSharedStudyState(code: string, userId: string): Promise<SharedStudyState | null> {
  await ensureDb();
  const sessionRows = (await sql.query("SELECT * FROM shared_study_sessions WHERE code = $1 LIMIT 1", [
    code.trim().toUpperCase(),
  ])) as Row[];
  if (!sessionRows.length) return null;
  const session = mapSharedSession(sessionRows[0]);
  const normalizedUserId = normalizeUserId(userId);
  const participantRows = (await sql.query(
    "SELECT * FROM shared_study_participants WHERE session_id = $1 ORDER BY joined_at",
    [session.id],
  )) as Row[];
  if (!participantRows.some((row) => String(row.user_id) === normalizedUserId)) {
    return null;
  }
  const answerRows = (await sql.query(
    "SELECT * FROM shared_study_answers WHERE session_id = $1 ORDER BY answered_at",
    [session.id],
  )) as Row[];
  return {
    session,
    participants: participantRows.map(mapSharedParticipant),
    answers: answerRows.map(mapSharedAnswer),
    questions: await getQuestionViewsByIds(session.questionIds, normalizedUserId),
    currentUserId: normalizedUserId,
  };
}

export async function submitSharedStudyAnswer(input: {
  code: string;
  userId: string;
  questionId: string;
  rating: Rating;
  selectedOptionId?: string | null;
}) {
  await ensureDb();
  const state = await getSharedStudyState(input.code, input.userId);
  if (!state) return null;
  if (!state.session.questionIds.includes(input.questionId)) {
    throw new Error("Question does not belong to this shared session");
  }
  const normalizedUserId = normalizeUserId(input.userId);
  const isCorrect = input.rating === "correct" || input.rating === "easy";
  const id = makeId("shared_answer");
  await sql.query(
    `INSERT INTO shared_study_answers
       (id, session_id, user_id, question_id, rating, selected_option_id, is_correct, answered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (session_id, user_id, question_id) DO UPDATE SET
       rating = EXCLUDED.rating,
       selected_option_id = EXCLUDED.selected_option_id,
       is_correct = EXCLUDED.is_correct,
       answered_at = now()`,
    [id, state.session.id, normalizedUserId, input.questionId, input.rating, input.selectedOptionId ?? null, isCorrect],
  );
  await createReviewEvent({
    userId: normalizedUserId,
    questionId: input.questionId,
    sessionId: state.session.id,
    rating: input.rating,
  });
  const rows = (await sql.query(
    "SELECT * FROM shared_study_answers WHERE session_id = $1 AND user_id = $2 AND question_id = $3",
    [state.session.id, normalizedUserId, input.questionId],
  )) as Row[];
  return rows[0] ? mapSharedAnswer(rows[0]) : null;
}

export async function getSharedStudyAssignments(code: string, userId: string): Promise<SharedStudyAssignment[] | null> {
  const state = await getSharedStudyState(code, userId);
  if (!state) return null;
  const participantMap = new Map(state.participants.map((item) => [item.userId, item]));
  return state.questions.map((question) => {
    const answers = state.answers.filter((answer) => answer.questionId === question.id);
    const correct = answers.filter((answer) => answer.rating === "correct" || answer.rating === "easy");
    const wrong = answers.filter((answer) => answer.rating === "wrong" || answer.rating === "partial");
    const assignedExplainers =
      correct.length > 0 && wrong.length > 0
        ? correct.map((answer) => {
            const participant = participantMap.get(answer.userId);
            return {
              userId: answer.userId,
              displayName: participant?.displayName ?? answer.userId,
            };
          })
        : [];
    return { question, assignedExplainers };
  });
}

function mapChatThread(row: Row): ChatThread {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    questionId: String(row.question_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapChatMessage(row: Row): ChatMessage {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    role: String(row.role) as ChatRole,
    content: String(row.content),
    citations: json<ChatMessage["citations"]>(row.citations, []),
    model: row.model ? String(row.model) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function getOrCreateChatThread(questionId: string, userId: string, isAdmin = false) {
  await ensureDb();
  if (!(await canAccessQuestion(questionId, isAdmin))) {
    return null;
  }
  const normalizedUserId = normalizeUserId(userId);
  const existing = (await sql.query(
    "SELECT * FROM chat_threads WHERE user_id = $1 AND question_id = $2 LIMIT 1",
    [normalizedUserId, questionId],
  )) as Row[];
  if (existing[0]) return mapChatThread(existing[0]);
  const id = makeId("chat");
  await sql.query(
    "INSERT INTO chat_threads (id, user_id, question_id, created_at) VALUES ($1, $2, $3, now())",
    [id, normalizedUserId, questionId],
  );
  const rows = (await sql.query("SELECT * FROM chat_threads WHERE id = $1", [id])) as Row[];
  return rows[0] ? mapChatThread(rows[0]) : null;
}

export async function getChatMessages(threadId: string, userId: string, isAdmin = false) {
  await ensureDb();
  const threadRows = (await sql.query("SELECT * FROM chat_threads WHERE id = $1 LIMIT 1", [threadId])) as Row[];
  if (!threadRows[0]) return null;
  const thread = mapChatThread(threadRows[0]);
  if (thread.userId !== normalizeUserId(userId) && !isAdmin) return null;
  const rows = (await sql.query("SELECT * FROM chat_messages WHERE thread_id = $1 ORDER BY created_at", [
    threadId,
  ])) as Row[];
  return rows.map(mapChatMessage);
}

export async function createChatMessage(input: {
  threadId: string;
  role: ChatRole;
  content: string;
  citations?: ChatMessage["citations"];
  model?: string | null;
}) {
  await ensureDb();
  const id = makeId("message");
  await sql.query(
    `INSERT INTO chat_messages (id, thread_id, role, content, citations, model, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())`,
    [id, input.threadId, input.role, input.content, JSON.stringify(input.citations ?? []), input.model ?? null],
  );
  const rows = (await sql.query("SELECT * FROM chat_messages WHERE id = $1", [id])) as Row[];
  return rows[0] ? mapChatMessage(rows[0]) : null;
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
     JOIN questions q ON q.id = qtm.question_id
     JOIN question_explanations qe ON qe.question_id = q.id
     JOIN review_events re ON re.question_id = qtm.question_id AND re.user_id = $1
     WHERE ${publishedQuestionSql("q", "qe").join(" AND ")}
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
     JOIN question_explanations qe ON qe.question_id = q.id
     JOIN review_events re ON re.question_id = q.id AND re.user_id = $1
     WHERE ${publishedQuestionSql("q", "qe").join(" AND ")}
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
