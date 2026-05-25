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
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(process.env.DATABASE_URL);

async function hasColumn(table, column) {
  const rows = await sql.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

const counts = await sql.query(`
  SELECT publication_status, question_type, COUNT(*)::int AS count
  FROM questions
  GROUP BY publication_status, question_type
  ORDER BY publication_status, question_type
`);

const publishedOpenQuestions = await sql.query(`
  SELECT id, question_text
  FROM questions
  WHERE publication_status = 'published'
    AND question_type <> 'multiple_choice'
  ORDER BY id
  LIMIT 50
`);

const publishedWithBadOptionCount = await sql.query(`
  SELECT q.id, q.question_text, COUNT(o.id)::int AS option_count
  FROM questions q
  LEFT JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
    AND q.question_type = 'multiple_choice'
  GROUP BY q.id, q.question_text
  HAVING COUNT(o.id) < 2 OR COUNT(o.id) > 6
  ORDER BY q.id
  LIMIT 50
`);

const publishedWithDuplicateLabels = await sql.query(`
  SELECT q.id, array_agg(o.label ORDER BY o.label) AS labels
  FROM questions q
  JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
    AND q.question_type = 'multiple_choice'
  GROUP BY q.id
  HAVING COUNT(*) <> COUNT(DISTINCT upper(trim(o.label)))
  ORDER BY q.id
  LIMIT 50
`);

const publishedWithDuplicateOptionText = await sql.query(`
  SELECT q.id, array_agg(o.text ORDER BY o.label) AS option_texts
  FROM questions q
  JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
    AND q.question_type = 'multiple_choice'
  GROUP BY q.id
  HAVING COUNT(*) <> COUNT(DISTINCT lower(regexp_replace(trim(o.text), '\\s+', ' ', 'g')))
  ORDER BY q.id
  LIMIT 50
`);

const publishedWithBadLabelSequence = await sql.query(`
  WITH option_labels AS (
    SELECT q.id,
           string_agg(upper(trim(o.label)), '' ORDER BY upper(trim(o.label))) AS labels,
           COUNT(o.id)::int AS option_count
    FROM questions q
    JOIN question_options o ON o.question_id = q.id
    WHERE q.publication_status = 'published'
      AND q.question_type = 'multiple_choice'
    GROUP BY q.id
  )
  SELECT id, labels, option_count
  FROM option_labels
  WHERE labels <> left('ABCDEF', option_count)
  ORDER BY id
  LIMIT 50
`);

const publishedWithBadAnswer = await sql.query(`
  SELECT q.id, qe.answer, array_agg(upper(trim(o.label)) ORDER BY upper(trim(o.label))) AS labels
  FROM questions q
  JOIN question_explanations qe ON qe.question_id = q.id
  JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
    AND q.question_type = 'multiple_choice'
  GROUP BY q.id, qe.answer
  HAVING upper(trim(qe.answer)) <> ALL(array_agg(upper(trim(o.label))))
  ORDER BY q.id
  LIMIT 50
`);

const publishedWithEmbeddedLaterMarker = await sql.query(`
  SELECT q.id, o.label, o.text
  FROM questions q
  JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
    AND q.question_type = 'multiple_choice'
    AND (
      (upper(trim(o.label)) = 'A' AND o.text ~* '(^|[[:space:]])[B-F][\\).:-][[:space:]]+')
      OR (upper(trim(o.label)) = 'B' AND o.text ~* '(^|[[:space:]])[C-F][\\).:-][[:space:]]+')
      OR (upper(trim(o.label)) = 'C' AND o.text ~* '(^|[[:space:]])[D-F][\\).:-][[:space:]]+')
      OR (upper(trim(o.label)) = 'D' AND o.text ~* '(^|[[:space:]])[E-F][\\).:-][[:space:]]+')
      OR (upper(trim(o.label)) = 'E' AND o.text ~* '(^|[[:space:]])F[\\).:-][[:space:]]+')
    )
  ORDER BY q.id, o.label
  LIMIT 50
`);

const publishedWithMetadata = await sql.query(`
  SELECT id, question_text
  FROM questions
  WHERE publication_status = 'published'
    AND (
      question_text ILIKE '%Fonte:%'
      OR question_text ILIKE '%Qualita:%'
      OR question_text ILIKE '%Qualità:%'
      OR question_text ILIKE '%## Immagini%'
      OR question_text ILIKE '%<!-- chunkId:%'
    )
  ORDER BY id
  LIMIT 50
`);

let publishedImplicitAllIneligible = [];
const hasCurrentProgramEligible = await hasColumn("questions", "current_program_eligible");
const hasProgramEligibility = await hasColumn("questions", "program_eligible");
const hasImplicitAll = await hasColumn("questions", "implicit_all");
if (hasImplicitAll && (hasCurrentProgramEligible || hasProgramEligibility)) {
  const eligibilityColumn = hasCurrentProgramEligible ? "current_program_eligible" : "program_eligible";
  publishedImplicitAllIneligible = await sql.query(`
    SELECT id, question_text
    FROM questions
    WHERE publication_status = 'published'
      AND implicit_all = true
      AND ${eligibilityColumn} = false
    ORDER BY id
    LIMIT 50
  `);
}

const sample = await sql.query(`
  SELECT q.id, q.question_text, qe.answer,
         json_agg(json_build_object('label', o.label, 'text', o.text) ORDER BY o.label) AS options
  FROM questions q
  JOIN question_explanations qe ON qe.question_id = q.id
  JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
    AND q.question_type = 'multiple_choice'
  GROUP BY q.id, q.question_text, qe.answer
  ORDER BY q.id
  LIMIT 5
`);

const failures = {
  publishedOpenQuestions,
  publishedWithBadOptionCount,
  publishedWithDuplicateLabels,
  publishedWithDuplicateOptionText,
  publishedWithBadLabelSequence,
  publishedWithBadAnswer,
  publishedWithEmbeddedLaterMarker,
  publishedWithMetadata,
  publishedImplicitAllIneligible,
};

const result = {
  counts,
  failureCounts: Object.fromEntries(Object.entries(failures).map(([key, value]) => [key, value.length])),
  failures,
  sample,
};

console.log(JSON.stringify(result, null, 2));

if (Object.values(failures).some((value) => value.length > 0)) {
  process.exitCode = 1;
}
