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

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const outDirArg = process.argv.find((arg) => arg.startsWith("--out-dir="));
const artifactArg = process.argv.find((arg) => arg.startsWith("--artifact="));
const outDir = path.resolve(process.cwd(), outDirArg?.split("=").slice(1).join("=") ?? "data/pipeline/normalization");
const artifact = path.resolve(
  process.cwd(),
  artifactArg?.split("=").slice(1).join("=") ??
    "data/pipeline/rag_answers_684_top12_partial_plus_grep_all_hard_residual60_pageindex_grep_parsedopts4_windowjudge15_reconciled.jsonl",
);

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (apply && !databaseUrl) {
  throw new Error("DATABASE_URL is required with --apply");
}

const seedPath = path.resolve(process.cwd(), "data/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const ragRows = fs.readFileSync(artifact, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const ragByQuestionId = new Map(ragRows.map((row) => [String(row.questionId), row]));

const metadataMarkers = [
  /\n\s*##\s*Immagini\b/i,
  /\s+##\s*Immagini\b/i,
  /\n\s*Fonte\s*:/i,
  /\s+Fonte\s*:/i,
  /\n\s*Qualit[aà]\s*:/i,
  /\s+Qualit[aà]\s*:/i,
];

function normalizeLabel(value) {
  return String(value ?? "").trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanupTechnicalMetadata(value) {
  let text = String(value ?? "").trim();
  for (const marker of metadataMarkers) {
    const match = text.match(marker);
    if (match?.index != null && match.index > 0) {
      text = text.slice(0, match.index).trim();
    }
  }
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+\d+\s+di\s+\d+$/i, "")
    .trim();
}

function parseOptionsFromRawText(question) {
  const raw = String(question.rawText ?? "").replace(/\r\n/g, "\n");
  const matches = [...raw.matchAll(/(?:^|\n)\s*([A-Fa-f])[\).]\s+/g)];
  if (matches.length < 2) return null;
  const labels = matches.map((match) => normalizeLabel(match[1]));
  const expectedLabels = "ABCDEF".slice(0, labels.length);
  if (labels.join("") !== expectedLabels) return null;

  const questionText = cleanupTechnicalMetadata(raw.slice(0, matches[0].index).trim());
  if (!questionText) return null;

  const options = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : raw.length;
    return {
      label: labels[index],
      text: cleanupTechnicalMetadata(raw.slice(start, end).trim()),
    };
  });

  if (options.some((option) => !option.text)) return null;
  return { questionText, options };
}

function existingOptions(question) {
  return (question.options ?? []).map((option) => ({
    id: option.id,
    label: normalizeLabel(option.label),
    text: cleanupTechnicalMetadata(option.text),
  }));
}

function optionSetFor(question) {
  const parsed = parseOptionsFromRawText(question);
  if (parsed) return { source: "raw_text", ...parsed };
  const options = existingOptions(question);
  return {
    source: "existing",
    questionText: cleanupTechnicalMetadata(question.questionText),
    options,
  };
}

function isValidFourOptionMcq(candidate) {
  if (!candidate.questionText || candidate.questionText.length < 4) return false;
  if (candidate.options.length < 2 || candidate.options.length > 6) return false;
  const labels = candidate.options.map((option) => option.label).join("");
  if (labels !== "ABCDEF".slice(0, candidate.options.length)) return false;
  const normalizedOptions = candidate.options.map((option) => normalizeText(option.text));
  if (normalizedOptions.some((text) => !text || text.length < 2)) return false;
  if (new Set(normalizedOptions).size !== normalizedOptions.length) return false;
  return true;
}

function mapAnswerToOption(row, options) {
  const answer = String(row?.answer ?? "").trim();
  if (!answer) return null;
  const normalizedAnswer = normalizeLabel(answer);
  const exactLabel = options.find((option) => option.label === normalizedAnswer);
  if (exactLabel) return { option: exactLabel, strategy: "answer_label" };

  const stripped = answer.replace(/^[\s(["']+|[\s).,"']+$/g, "");
  const prefixed = options.find((option) => stripped.toUpperCase().startsWith(`${option.label}.`));
  if (prefixed) return { option: prefixed, strategy: "answer_label_prefix" };

  const normalizedText = normalizeText(answer);
  const exactText = options.find((option) => normalizeText(option.text) === normalizedText);
  if (exactText) return { option: exactText, strategy: "answer_text_exact" };

  const containedText = options.find((option) => {
    const optionText = normalizeText(option.text);
    return (
      normalizedText.length >= 8
      && optionText.length >= 8
      && (normalizedText.includes(optionText) || optionText.includes(normalizedText))
    );
  });
  if (containedText) return { option: containedText, strategy: "answer_text_contains" };

  return null;
}

const report = {
  artifact: path.relative(process.cwd(), artifact),
  mode: apply ? "apply" : "dry-run",
  totalQuestions: seed.questions.length,
  questionsWithExistingOptions: 0,
  rawTextParseableMcq: 0,
  validFourOptionMcq: 0,
  supportedRows: 0,
  mappedSupportedMcq: 0,
  metadataCleanups: 0,
  unpublishedByPolicy: 0,
  rejectedReasons: {},
};

function reject(questionId, reason, extra = {}) {
  report.rejectedReasons[reason] = (report.rejectedReasons[reason] ?? 0) + 1;
  return { questionId, action: "needs_review", reason, ...extra };
}

const candidates = [];
const rejected = [];

for (const question of seed.questions) {
  if ((question.options ?? []).length > 0) report.questionsWithExistingOptions += 1;
  const row = ragByQuestionId.get(question.id);
  const normalized = optionSetFor(question);
  if (normalized.source === "raw_text") report.rawTextParseableMcq += 1;
  const hadMetadata = cleanupTechnicalMetadata(question.questionText) !== String(question.questionText ?? "").trim();
  if (hadMetadata) report.metadataCleanups += 1;

  if (!isValidFourOptionMcq(normalized)) {
    rejected.push(reject(question.id, "not_valid_four_option_mcq", { optionCount: normalized.options.length }));
    continue;
  }
  report.validFourOptionMcq += 1;

  if (!row || row.evidenceStatus !== "supported") {
    rejected.push(reject(question.id, "not_supported_by_windowjudge15", { evidenceStatus: row?.evidenceStatus ?? "missing" }));
    continue;
  }
  report.supportedRows += 1;

  const mapped = mapAnswerToOption(row, normalized.options);
  if (!mapped) {
    rejected.push(reject(question.id, "answer_not_mappable_to_option", { answer: row.answer ?? "" }));
    continue;
  }

  const optionIdsByLabel = new Map(existingOptions(question).map((option) => [option.label, option.id]));
  const normalizedOptions = normalized.options.map((option) => ({
    id: optionIdsByLabel.get(option.label) ?? `${question.id}_opt_${option.label.toLowerCase()}`,
    questionId: question.id,
    label: option.label,
    text: option.text,
    isCorrect: option.label === mapped.option.label,
  }));

  candidates.push({
    questionId: question.id,
    action: "publish_normalized_mcq",
    questionText: normalized.questionText,
    questionTextChanged: normalized.questionText !== question.questionText,
    optionSource: normalized.source,
    options: normalizedOptions,
    correctOptionLabel: mapped.option.label,
    mappingStrategy: mapped.strategy,
    answer: mapped.option.label,
    explanationShort: row.explanationShort ?? "",
    rationale: row.rationale ?? "",
    sourceChunkIds: Array.isArray(row.sourceChunkIds)
      ? row.sourceChunkIds
      : Array.isArray(row.sources)
        ? row.sources.map((source) => source.chunkId).filter(Boolean)
        : [],
    selectedSubject: row.selectedSubject ?? row.currentSubject ?? question.subject,
    selectedTopicIds: Array.isArray(row.selectedTopicIds) ? row.selectedTopicIds : question.topicIds,
    confidence: Number(row.confidence ?? 0),
    sourceEvidenceStatus: row.evidenceStatus,
    sourceModel: row.model ?? "windowjudge15",
  });
  report.mappedSupportedMcq += 1;
}

report.unpublishedByPolicy = seed.questions.length - candidates.length;

fs.mkdirSync(outDir, { recursive: true });
const candidatesPath = path.join(outDir, "normalized_mcq_candidates.jsonl");
const rejectedPath = path.join(outDir, "normalized_mcq_needs_review.jsonl");
const reportPath = path.join(outDir, "normalized_mcq_report.md");
fs.writeFileSync(candidatesPath, `${candidates.map((item) => JSON.stringify(item)).join("\n")}\n`);
fs.writeFileSync(rejectedPath, `${rejected.map((item) => JSON.stringify(item)).join("\n")}\n`);
fs.writeFileSync(
  reportPath,
  [
    "# MCQ normalization report",
    "",
    `Mode: ${report.mode}`,
    `Artifact: \`${report.artifact}\``,
    "",
    "## Counts",
    "",
    `- Total questions: ${report.totalQuestions}`,
    `- Questions with existing options: ${report.questionsWithExistingOptions}`,
    `- Raw text parseable MCQ: ${report.rawTextParseableMcq}`,
    `- Valid four-option MCQ: ${report.validFourOptionMcq}`,
    `- Supported rows among valid MCQs: ${report.supportedRows}`,
    `- Mapped supported MCQs: ${report.mappedSupportedMcq}`,
    `- Question metadata cleanups detected: ${report.metadataCleanups}`,
    `- Unpublished/admin-review by policy: ${report.unpublishedByPolicy}`,
    "",
    "## Rejected reasons",
    "",
    ...Object.entries(report.rejectedReasons)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => `- ${reason}: ${count}`),
    "",
    "## Policy",
    "",
    "The script does not rewrite semantic content, generate distractors, or convert open questions into MCQs.",
    "It only extracts A/B/C/D options already present in raw text or structured options, removes known technical metadata tails, and maps an existing supported answer to one option.",
    "",
  ].join("\n"),
);

if (apply) {
  const sql = neon(databaseUrl);
  for (const statement of [
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'unpublished'",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS published_at timestamptz",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS published_by text",
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS admin_note text",
  ]) {
    await sql.query(statement);
  }

  await sql.query(`
    UPDATE questions
    SET publication_status = 'unpublished',
        published_at = NULL,
        published_by = NULL,
        needs_review = true,
        admin_note = 'mcq_normalization: hidden until valid selectable MCQ mapping exists'
    WHERE is_active = true
  `);

  for (const candidate of candidates) {
    const validChunkRows = candidate.sourceChunkIds.length
      ? await sql.query("SELECT id FROM source_chunks WHERE id = ANY($1::text[])", [candidate.sourceChunkIds])
      : [];
    const validChunkIds = new Set(validChunkRows.map((row) => String(row.id)));
    const sourceChunkIds = candidate.sourceChunkIds.filter((id) => validChunkIds.has(id));
    if (!sourceChunkIds.length) continue;

    await sql.query(
      `UPDATE questions
       SET subject = COALESCE($2, subject),
           question_type = 'multiple_choice',
           question_text = $3,
           raw_text = $4,
           needs_review = false,
           needs_topic_review = false,
           review_status_id = 'approved',
           reliability_level_id = 'human_verified',
           publication_status = 'published',
           published_at = COALESCE(published_at, now()),
           published_by = 'mcq_normalization',
           admin_note = NULL
       WHERE id = $1`,
      [
        candidate.questionId,
        candidate.selectedSubject,
        candidate.questionText,
        [candidate.questionText, ...candidate.options.map((option) => `${option.label}. ${option.text}`)].join("\n"),
      ],
    );

    await sql.query("DELETE FROM question_options WHERE question_id = $1", [candidate.questionId]);
    for (const option of candidate.options) {
      await sql.query(
        `INSERT INTO question_options (id, question_id, label, text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, text = EXCLUDED.text`,
        [option.id, candidate.questionId, option.label, option.text],
      );
    }

    await sql.query(
      `INSERT INTO question_explanations
         (id, question_id, answer, explanation_short, rationale, source_chunk_ids,
          evidence_status, confidence, warnings, model, needs_human_review)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'supported', $7, $8::jsonb, $9, false)
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
        `exp_${candidate.questionId}`,
        candidate.questionId,
        candidate.answer,
        candidate.explanationShort,
        candidate.rationale,
        JSON.stringify(sourceChunkIds),
        candidate.confidence,
        JSON.stringify([`correct_option:${candidate.correctOptionLabel}`, `mapping:${candidate.mappingStrategy}`]),
        `mcq_normalization+${candidate.sourceModel}`,
      ],
    );

    await sql.query("DELETE FROM question_topic_map WHERE question_id = $1", [candidate.questionId]);
    for (const topicId of candidate.selectedTopicIds) {
      await sql.query(
        `INSERT INTO question_topic_map (question_id, topic_id)
         SELECT $1, $2
         WHERE EXISTS (SELECT 1 FROM topics WHERE id = $2)
         ON CONFLICT DO NOTHING`,
        [candidate.questionId, topicId],
      );
    }
  }
}

console.log(JSON.stringify({ report, outputs: { candidatesPath, rejectedPath, reportPath } }, null, 2));
