import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const PROGRAM_ELIGIBILITY_POLICY_VERSION = "program-eligibility-v1";

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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[name] = true;
      continue;
    }
    args[name] = next;
    index += 1;
  }
  return args;
}

function normalizeText(value) {
  const raw = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textFrom(parts) {
  return normalizeText(parts.flat().filter(Boolean).join(" "));
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function stemWithoutEmbeddedOptions(value) {
  const text = String(value ?? "").replace(/\r\n/g, "\n");
  const matches = [...text.matchAll(/(?:^|\n|\s)([A-Fa-f])[\).:-]\s+/g)];
  if (matches.length < 2) return text;
  const labels = matches.map((match) => match[1].toUpperCase()).join("");
  if (!"ABCDEF".startsWith(labels)) return text;
  const firstIndex = matches[0]?.index ?? -1;
  return firstIndex > 0 ? text.slice(0, firstIndex) : text;
}

function decision(eligible, reasonCode, reasonLabel, matchedRule) {
  return {
    eligible,
    reasonCode,
    reasonLabel,
    matchedRule,
    policyVersion: PROGRAM_ELIGIBILITY_POLICY_VERSION,
  };
}

const ANATOMIA_2_PATTERNS = [
  /\banatomia 2\b/,
  /\banato 2\b/,
  /\banatomia_2_cusella\b/,
  /\banato 2 cusella\b/,
];
const REPRODUCTIVE_PATTERNS = [
  /\bapparato genitale\b/,
  /\bapparato riproduttivo\b/,
  /\bsistema riproduttivo\b/,
  /\bgenitale\b/,
  /\bgenitali\b/,
  /\breproductive\b/,
  /\butero\b/,
  /\buterin[aoei]\b/,
  /\buterus\b/,
  /\bovaio\b/,
  /\bovaie\b/,
  /\bovary\b/,
  /\bovarian\b/,
  /\btube uterine\b/,
  /\bcervice\b/,
  /\btesticolo\b/,
  /\btesticoli\b/,
  /\btestis\b/,
  /\bprostata\b/,
  /\bprostate\b/,
  /\bpene\b/,
  /\bvagina\b/,
];
const ABDOMINO_PELVIC_PATTERNS = [
  /\bcavita addomino pelvica\b/,
  /\bcavita addominopelvica\b/,
  /\baddomino pelvica\b/,
  /\baddominopelvica\b/,
  /\baddome\b/,
  /\bpelvi\b/,
  /\bperitoneo\b/,
  /\bmesentere\b/,
  /\bomento\b/,
  /\bretroperitoneo\b/,
  /\bstomaco\b/,
  /\bintestino\b/,
  /\bcolon\b/,
  /\bduodeno\b/,
  /\bdigiuno\b/,
  /\bileo\b/,
  /\bretto\b/,
  /\bfegato\b/,
  /\bvie biliari\b/,
  /\bcoledoco\b/,
  /\bcolecisti\b/,
  /\brene\b/,
  /\buretere\b/,
  /\bvescica\b/,
  /\binguinale\b/,
];
const ABDOMINAL_EXCEPTION_PATTERNS = [
  /\bsurrene\b/,
  /\bsurreni\b/,
  /\badrenal\b/,
  /\bpancreas\b/,
  /\bmilza\b/,
  /\bspleen\b/,
];

function topicDecision(topic) {
  const text = textFrom([
    topic.id,
    topic.title,
    topic.module_id,
    topic.module_title,
    topic.source_path,
    topic.module_source_path,
    Array.isArray(topic.path) ? topic.path : [],
  ]);
  if (matchesAny(text, ANATOMIA_2_PATTERNS)) {
    return decision(false, "excluded_anatomia_2", "Anatomia 2 is outside the current program", "anatomia_2");
  }
  const reproductive = matchesAny(text, REPRODUCTIVE_PATTERNS);
  const abdominal = matchesAny(text, ABDOMINO_PELVIC_PATTERNS);
  const exception = matchesAny(text, ABDOMINAL_EXCEPTION_PATTERNS);
  if ((reproductive || abdominal) && exception) {
    return decision(true, "eligible_exception_topic", "Current-program exception topic", "abdominal_exception");
  }
  if (reproductive) {
    return decision(false, "excluded_reproductive", "Reproductive-system topic is outside the current program", "reproductive");
  }
  if (abdominal) {
    return decision(false, "excluded_abdomino_pelvic", "Abdomino-pelvic topic is outside the current program", "abdomino_pelvic");
  }
  return decision(true, "eligible_topic", "Topic is in the current program", "default_topic");
}

function questionDecision(question) {
  if (question.question_type === "open" || Number(question.option_count) === 0) {
    return decision(false, "excluded_open_answer", "Open-answer cards are not public in Tutti", "open_answer");
  }
  const sourceText = textFrom([
    question.source_refs,
    question.source_paths,
    question.source_titles,
  ]);
  if (matchesAny(sourceText, ANATOMIA_2_PATTERNS)) {
    return decision(false, "excluded_anatomia_2", "Anatomia 2 is outside the current program", "anatomia_2_source");
  }
  const questionText = textFrom([
    stemWithoutEmbeddedOptions(question.question_text),
    stemWithoutEmbeddedOptions(question.raw_text),
  ]);
  const reproductiveText = matchesAny(questionText, REPRODUCTIVE_PATTERNS);
  const abdominalText = matchesAny(questionText, ABDOMINO_PELVIC_PATTERNS);
  const exceptionText = matchesAny(questionText, ABDOMINAL_EXCEPTION_PATTERNS);
  if (reproductiveText) {
    return decision(false, "excluded_reproductive", "Reproductive-system card is outside the current program", "reproductive_question_text");
  }
  if (abdominalText && !exceptionText) {
    return decision(false, "excluded_abdomino_pelvic", "Abdomino-pelvic card is outside the current program", "abdomino_pelvic_question_text");
  }
  const topics = Array.isArray(question.topics) ? question.topics : [];
  if (topics.length === 0) {
    return decision(false, "unclassified_no_topic", "Question has no topic classification", "missing_topic");
  }
  const decisions = topics.map(topicDecision);
  const hardExclusion = decisions.find((item) => item.reasonCode === "excluded_anatomia_2");
  if (hardExclusion) return hardExclusion;
  const eligibleCount = decisions.filter((item) => item.eligible).length;
  if (eligibleCount > 0 && eligibleCount < decisions.length) {
    return decision(true, "mixed_topics_has_eligible_topic", "Question has at least one current-program topic", "mixed_topics");
  }
  if (eligibleCount > 0) {
    return decision(true, "eligible_topic", "Question is in the current program", "eligible_topics");
  }
  return decisions[0];
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const questionId = typeof args["question-id"] === "string" ? args["question-id"] : null;
const limit = args.limit == null ? null : Number.parseInt(String(args.limit), 10);
if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
  throw new Error("--limit must be a positive integer");
}

const sql = neon(process.env.DATABASE_URL);

await sql.query("ALTER TABLE questions ADD COLUMN IF NOT EXISTS program_eligible boolean NOT NULL DEFAULT false");
await sql.query("ALTER TABLE questions ADD COLUMN IF NOT EXISTS program_eligibility_reason text NOT NULL DEFAULT 'unclassified'");
await sql.query(
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS program_eligibility_policy_version text NOT NULL DEFAULT '${PROGRAM_ELIGIBILITY_POLICY_VERSION}'`,
);
await sql.query("ALTER TABLE questions ADD COLUMN IF NOT EXISTS program_eligibility_updated_at timestamptz");
await sql.query("CREATE INDEX IF NOT EXISTS idx_questions_program_eligible ON questions (program_eligible) WHERE is_active = true");

const params = [];
const where = ["q.is_active = true"];
if (questionId) {
  params.push(questionId);
  where.push(`q.id = $${params.length}`);
}

const limitSql = limit == null ? "" : `LIMIT ${limit}`;
const rows = await sql.query(
  `SELECT
     q.id,
     q.question_type,
     q.question_text,
     q.raw_text,
     q.source_refs,
     q.publication_status,
     COUNT(qo.id)::int AS option_count,
     COALESCE(
       jsonb_agg(DISTINCT jsonb_build_object(
         'id', t.id,
         'title', t.title,
         'module_id', t.module_id,
         'module_title', m.title,
         'source_path', t.source_path,
         'module_source_path', m.source_path,
         'path', t.path
       )) FILTER (WHERE t.id IS NOT NULL),
       '[]'::jsonb
     ) AS topics,
     COALESCE(jsonb_agg(DISTINCT sc.source_path) FILTER (WHERE sc.id IS NOT NULL), '[]'::jsonb) AS source_paths,
     COALESCE(jsonb_agg(DISTINCT sc.source_title) FILTER (WHERE sc.id IS NOT NULL), '[]'::jsonb) AS source_titles
   FROM questions q
   LEFT JOIN question_options qo ON qo.question_id = q.id
   LEFT JOIN question_topic_map qtm ON qtm.question_id = q.id
   LEFT JOIN topics t ON t.id = qtm.topic_id
   LEFT JOIN modules m ON m.id = t.module_id
   LEFT JOIN question_explanations qe ON qe.question_id = q.id
   LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(qe.source_chunk_ids, '[]'::jsonb)) chunk_id(id) ON true
   LEFT JOIN source_chunks sc ON sc.id = chunk_id.id
   WHERE ${where.join(" AND ")}
   GROUP BY q.id
   ORDER BY q.id
   ${limitSql}`,
  params,
);

const updates = rows.map((row) => ({ id: row.id, publicationStatus: row.publication_status, decision: questionDecision(row) }));

if (apply && updates.length > 0) {
  for (const update of updates) {
    await sql.query(
      `UPDATE questions
       SET
         program_eligible = $2,
         program_eligibility_reason = $3,
         program_eligibility_policy_version = $4,
         program_eligibility_updated_at = now()
       WHERE id = $1`,
      [update.id, update.decision.eligible, update.decision.reasonCode, update.decision.policyVersion],
    );
  }
}

const countsByReason = new Map();
const samplesByReason = new Map();
let published = 0;
let eligiblePublished = 0;
let excludedPublished = 0;
for (const update of updates) {
  const reason = update.decision.reasonCode;
  countsByReason.set(reason, (countsByReason.get(reason) ?? 0) + 1);
  const samples = samplesByReason.get(reason) ?? [];
  if (samples.length < 8) samples.push(update.id);
  samplesByReason.set(reason, samples);
  if (update.publicationStatus === "published") {
    published += 1;
    if (update.decision.eligible) eligiblePublished += 1;
    else excludedPublished += 1;
  }
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      policyVersion: PROGRAM_ELIGIBILITY_POLICY_VERSION,
      totalQuestions: updates.length,
      publishedQuestions: published,
      eligiblePublishedQuestions: eligiblePublished,
      excludedPublishedQuestions: excludedPublished,
      countsByReason: Object.fromEntries([...countsByReason.entries()].sort((a, b) => b[1] - a[1])),
      samplesByReason: Object.fromEntries(samplesByReason.entries()),
    },
    null,
    2,
  ),
);
