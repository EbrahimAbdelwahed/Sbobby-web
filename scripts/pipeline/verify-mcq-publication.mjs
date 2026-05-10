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

const counts = await sql.query(`
  SELECT publication_status, question_type, COUNT(*)::int AS count
  FROM questions
  GROUP BY publication_status, question_type
  ORDER BY publication_status, question_type
`);

const publishedWithBadOptionCount = await sql.query(`
  SELECT q.id, q.question_text, COUNT(o.id)::int AS option_count
  FROM questions q
  LEFT JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
  GROUP BY q.id, q.question_text
  HAVING COUNT(o.id) <> 4
  ORDER BY q.id
  LIMIT 20
`);

const publishedWithBadAnswer = await sql.query(`
  SELECT q.id, qe.answer
  FROM questions q
  JOIN question_explanations qe ON qe.question_id = q.id
  WHERE q.publication_status = 'published'
    AND upper(trim(qe.answer)) NOT IN ('A', 'B', 'C', 'D')
  ORDER BY q.id
  LIMIT 20
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
    )
  ORDER BY id
  LIMIT 20
`);

const sample = await sql.query(`
  SELECT q.id, q.question_text, qe.answer,
         json_agg(json_build_object('label', o.label, 'text', o.text) ORDER BY o.label) AS options
  FROM questions q
  JOIN question_explanations qe ON qe.question_id = q.id
  JOIN question_options o ON o.question_id = q.id
  WHERE q.publication_status = 'published'
  GROUP BY q.id, q.question_text, qe.answer
  ORDER BY q.id
  LIMIT 5
`);

const result = {
  counts,
  publishedWithBadOptionCount,
  publishedWithBadAnswer,
  publishedWithMetadata,
  sample,
};

console.log(JSON.stringify(result, null, 2));

if (publishedWithBadOptionCount.length || publishedWithBadAnswer.length || publishedWithMetadata.length) {
  process.exitCode = 1;
}
