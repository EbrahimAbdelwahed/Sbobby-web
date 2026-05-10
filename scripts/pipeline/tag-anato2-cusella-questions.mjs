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

const moduleId = "anatomia_2_cusella";
const topicId = "anatomia_2_cusella_source_questions";
const sourcePattern = "%ANATO 2 CUSELLA 2024-2025%";

await sql.query(
  `INSERT INTO modules (id, subject_id, title, source_path)
   VALUES ($1, 'anatomia', 'Anatomia 2 (prof. Cusella)', 'sbobine_prec/ANATO 2 CUSELLA 2024-2025 unificato.pdf')
   ON CONFLICT (id) DO UPDATE SET
     title = EXCLUDED.title,
     source_path = EXCLUDED.source_path`,
  [moduleId],
);

await sql.query(
  `INSERT INTO topics (id, title, module_id, subject, source_path, parent_topic_id, level, display_order, path)
   VALUES (
     $1,
     'Domande da ANATO 2 CUSELLA 2024-2025',
     $2,
     'anatomia',
     'sbobine_prec/ANATO 2 CUSELLA 2024-2025 unificato.pdf',
     NULL,
     1,
     0,
     $3::jsonb
   )
   ON CONFLICT (id) DO UPDATE SET
     title = EXCLUDED.title,
     module_id = EXCLUDED.module_id,
     subject = EXCLUDED.subject,
     source_path = EXCLUDED.source_path,
     path = EXCLUDED.path`,
  [topicId, moduleId, JSON.stringify(["Anatomia 2 (prof. Cusella)", "Domande da ANATO 2 CUSELLA 2024-2025"])],
);

const rows = await sql.query(
  `WITH anato2_questions AS (
     SELECT DISTINCT qe.question_id
     FROM question_explanations qe
     JOIN LATERAL jsonb_array_elements_text(qe.source_chunk_ids) source_chunk_id(id) ON true
     JOIN source_chunks sc ON sc.id = source_chunk_id.id
     WHERE sc.source_path ILIKE $1 OR sc.source_title ILIKE $1
   )
   INSERT INTO question_topic_map (question_id, topic_id)
   SELECT question_id, $2
   FROM anato2_questions
   ON CONFLICT DO NOTHING
   RETURNING question_id`,
  [sourcePattern, topicId],
);

const totals = await sql.query(
  `SELECT
     COUNT(*) FILTER (WHERE q.publication_status = 'published')::int AS published_tagged,
     COUNT(*) FILTER (WHERE q.publication_status <> 'published')::int AS unpublished_tagged,
     COUNT(*)::int AS total_tagged
   FROM question_topic_map qtm
   JOIN questions q ON q.id = qtm.question_id
   WHERE qtm.topic_id = $1`,
  [topicId],
);

console.log(JSON.stringify({ moduleId, topicId, inserted: rows.length, totals: totals[0] }, null, 2));
