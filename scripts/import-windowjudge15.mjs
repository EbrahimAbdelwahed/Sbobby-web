import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

function loadEnvFile(file) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const artifact =
  process.argv[2] ??
  "data/pipeline/rag_answers_684_top12_partial_plus_grep_all_hard_residual60_pageindex_grep_parsedopts4_windowjudge15_reconciled.jsonl";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(databaseUrl);
const filePath = path.resolve(process.cwd(), artifact);
const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);

const counts = {
  totalRows: 0,
  published: 0,
  leftForAdminReview: 0,
  skipped: 0,
  missingQuestionIds: 0,
  missingOrInvalidChunkIds: 0,
};

async function ensurePublicationColumns() {
  const statements = [
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'unpublished'",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS published_at timestamptz",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS published_by text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS admin_note text",
  ];
  for (const statement of statements) {
    await sql.query(statement);
  }
}

await ensurePublicationColumns();

for (const line of lines) {
  counts.totalRows += 1;
  const row = JSON.parse(line);
  const questionId = row.questionId;
  if (!questionId) {
    counts.skipped += 1;
    counts.missingQuestionIds += 1;
    continue;
  }

  const questionRows = await sql.query("SELECT id FROM questions WHERE id = $1", [questionId]);
  if (!questionRows.length) {
    counts.skipped += 1;
    counts.missingQuestionIds += 1;
    continue;
  }

  const sourceChunkIds = Array.isArray(row.sourceChunkIds) ? row.sourceChunkIds.filter(Boolean) : [];
  const validChunkRows = sourceChunkIds.length
    ? await sql.query("SELECT id FROM source_chunks WHERE id = ANY($1::text[])", [sourceChunkIds])
    : [];
  const validChunkIds = new Set(validChunkRows.map((item) => String(item.id)));
  const validSourceChunkIds = sourceChunkIds.filter((id) => validChunkIds.has(id));
  const canPublish = row.evidenceStatus === "supported" && validSourceChunkIds.length > 0;

  if (sourceChunkIds.length !== validSourceChunkIds.length || validSourceChunkIds.length === 0) {
    counts.missingOrInvalidChunkIds += 1;
  }

  await sql.query(
    `INSERT INTO question_explanations
       (id, question_id, answer, explanation_short, rationale, source_chunk_ids,
        evidence_status, confidence, warnings, model, needs_human_review)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11)
     ON CONFLICT (question_id) DO UPDATE SET
       answer = EXCLUDED.answer,
       explanation_short = EXCLUDED.explanation_short,
       rationale = EXCLUDED.rationale,
       source_chunk_ids = EXCLUDED.source_chunk_ids,
       evidence_status = EXCLUDED.evidence_status,
       confidence = EXCLUDED.confidence,
       warnings = EXCLUDED.warnings,
       model = EXCLUDED.model,
       needs_human_review = EXCLUDED.needs_human_review`,
    [
      `exp_${questionId}`,
      questionId,
      row.answer ?? "",
      row.explanationShort ?? "",
      row.rationale ?? "",
      JSON.stringify(validSourceChunkIds),
      row.evidenceStatus ?? "insufficient_evidence",
      Number(row.confidence ?? 0),
      JSON.stringify(Array.isArray(row.warnings) ? row.warnings : []),
      row.model ?? "windowjudge15",
      !canPublish,
    ],
  );

  await sql.query(
    `UPDATE questions SET
       subject = COALESCE($2, subject),
       needs_topic_review = COALESCE($3, needs_topic_review),
       review_status_id = CASE WHEN $4 THEN 'approved' ELSE review_status_id END,
       reliability_level_id = CASE WHEN $4 THEN 'human_verified' ELSE reliability_level_id END,
       publication_status = CASE WHEN $4 THEN 'published' ELSE 'unpublished' END,
       published_at = CASE WHEN $4 THEN COALESCE(published_at, now()) ELSE NULL END,
       published_by = CASE WHEN $4 THEN 'windowjudge15_import' ELSE NULL END,
       needs_review = NOT $4,
       admin_note = CASE WHEN $4 THEN NULL ELSE $5 END
     WHERE id = $1`,
    [
      questionId,
      row.selectedSubject ?? row.currentSubject ?? null,
      Boolean(row.topicNeedsReview ?? false),
      canPublish,
      `windowjudge15: ${row.evidenceStatus ?? "unknown"}${validSourceChunkIds.length ? "" : "; missing valid source chunks"}`,
    ],
  );

  await sql.query("DELETE FROM question_topic_map WHERE question_id = $1", [questionId]);
  const topicIds = Array.isArray(row.selectedTopicIds) ? row.selectedTopicIds : [];
  for (const topicId of topicIds) {
    await sql.query(
      `INSERT INTO question_topic_map (question_id, topic_id)
       SELECT $1, $2
       WHERE EXISTS (SELECT 1 FROM topics WHERE id = $2)
       ON CONFLICT DO NOTHING`,
      [questionId, topicId],
    );
  }

  if (canPublish) counts.published += 1;
  else counts.leftForAdminReview += 1;
}

console.log(JSON.stringify({ artifact, counts }, null, 2));
