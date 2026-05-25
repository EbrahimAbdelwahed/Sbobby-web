import fs from "node:fs";
import crypto from "node:crypto";
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

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--") && !arg.includes("=")));
const apply = flags.has("--apply");
const fromReports = flags.has("--from-reports");
const includePublished = flags.has("--include-published");
const excludePublished = flags.has("--exclude-published");
const useDeepseek = flags.has("--use-deepseek");
const outDir = path.resolve(process.cwd(), readArg("out-dir", "data/pipeline/question-repair"));
const artifact = path.resolve(
  process.cwd(),
  readArg(
    "artifact",
    "data/pipeline/rag_answers_684_top12_partial_plus_grep_all_hard_residual60_pageindex_grep_parsedopts4_windowjudge15_reconciled.jsonl",
  ),
);
const candidateFile = readArg("candidate-file", null);
const rollbackFile = readArg("rollback-file", null);
const questionIds = new Set(String(readArg("question-id", "")).split(",").map((id) => id.trim()).filter(Boolean));

loadEnvFile(".env.local");
loadEnvFile(".env");

if (useDeepseek) {
  throw new Error("--use-deepseek is reserved for a future classifier pass; deterministic repair is implemented here.");
}
if ((apply || rollbackFile) && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for --apply or --rollback-file");
}

const metadataMarkers = [
  /\n\s*##\s*Immagini\b/i,
  /\s+##\s*Immagini\b/i,
  /\n\s*Fonte\s*:/i,
  /\s+Fonte\s*:/i,
  /\n\s*Qualit[aà]\s*:/i,
  /\s+Qualit[aà]\s*:/i,
  /\n\s*<!--\s*chunkId:/i,
];

function normalizeLabel(value) {
  return String(value ?? "").trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanupText(value) {
  let text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  for (const marker of metadataMarkers) {
    const match = text.match(marker);
    if (match?.index != null && match.index > 0) text = text.slice(0, match.index).trim();
  }
  return text.replace(/\s+/g, " ").replace(/\s+\d+\s+di\s+\d+$/i, "").trim();
}

function hasMetadata(value) {
  return metadataMarkers.some((marker) => marker.test(String(value ?? "")));
}

function laterOptionMarker(label, text) {
  const labels = "ABCDEF";
  const start = labels.indexOf(label) + 1;
  if (start <= 0) return null;
  const pattern = new RegExp(`(?:^|\\s|\\n)([${labels.slice(start)}])[\\).:-]\\s+`, "i");
  return String(text ?? "").match(pattern)?.[1]?.toUpperCase() ?? null;
}

function parseOptions(text, source) {
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  const matches = [...raw.matchAll(/(?:^|\n)\s*([A-Fa-f])[\).:-]\s+/g)];
  if (matches.length < 2 || matches.length > 6) return null;
  const labels = matches.map((match) => normalizeLabel(match[1]));
  if (labels.join("") !== "ABCDEF".slice(0, labels.length)) return null;
  const questionText = cleanupText(raw.slice(0, matches[0].index));
  if (!questionText || questionText.length < 4) return null;
  const options = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : raw.length;
    return { label: labels[index], text: cleanupText(raw.slice(start, end)) };
  });
  return validateOptionSet({ questionText, options, source });
}

function validateOptionSet(candidate) {
  const warnings = [];
  const options = candidate.options ?? [];
  if (!candidate.questionText || candidate.questionText.length < 4) return null;
  if (options.length < 2 || options.length > 6) return null;
  const labels = options.map((option) => normalizeLabel(option.label));
  if (labels.join("") !== "ABCDEF".slice(0, labels.length)) return null;
  const texts = options.map((option) => normalizeText(option.text));
  if (texts.some((text) => text.length < 2)) return null;
  if (new Set(texts).size !== texts.length) return null;
  for (const option of options) {
    const marker = laterOptionMarker(normalizeLabel(option.label), option.text);
    if (marker) warnings.push(`option_${option.label}_contains_later_marker_${marker}`);
  }
  if (warnings.length) return null;
  return {
    questionText: cleanupText(candidate.questionText),
    options: options.map((option) => ({ label: normalizeLabel(option.label), text: cleanupText(option.text) })),
    source: candidate.source,
  };
}

function existingOptions(question) {
  return (question.options ?? []).map((option) => ({
    id: option.id,
    label: normalizeLabel(option.label),
    text: cleanupText(option.text),
  }));
}

function detectOptions(question) {
  const rawParsed = parseOptions(question.rawText, "raw_text");
  if (rawParsed) return rawParsed;
  const questionParsed = parseOptions(question.questionText, "question_text");
  if (questionParsed) return questionParsed;
  const options = existingOptions(question);
  const existing = validateOptionSet({ questionText: question.questionText, options, source: "existing_options" });
  if (existing) return existing;
  const joined = [question.questionText, ...options.map((option) => `${option.label}. ${option.text}`)].join("\n");
  const repaired = parseOptions(joined, "option_split_repair");
  if (repaired) return repaired;
  return null;
}

function mapAnswer(row, explanation, options) {
  const answer = String(row?.answer ?? explanation?.answer ?? "").trim();
  if (!answer || /^n\/?a$/i.test(answer)) return null;
  const label = normalizeLabel(answer);
  const exactLabel = options.find((option) => option.label === label);
  if (exactLabel) return { label: exactLabel.label, strategy: "answer_label", answerBefore: answer };
  const stripped = answer.replace(/^[\s(["']+|[\s).,"']+$/g, "");
  const markedLabel = stripped.match(/^([A-Fa-f])[\).:-]\s+/);
  if (markedLabel) {
    const marked = options.find((option) => option.label === markedLabel[1].toUpperCase());
    if (marked) return { label: marked.label, strategy: "answer_label_marker_prefix", answerBefore: answer };
  }
  const prefixed = options.find((option) => stripped.toUpperCase().startsWith(`${option.label}.`));
  if (prefixed) return { label: prefixed.label, strategy: "answer_label_prefix", answerBefore: answer };
  const normalizedAnswer = normalizeText(answer);
  const exactText = options.filter((option) => normalizeText(option.text) === normalizedAnswer);
  if (exactText.length === 1) return { label: exactText[0].label, strategy: "answer_text_exact", answerBefore: answer };
  const contained = options.filter((option) => {
    const optionText = normalizeText(option.text);
    return normalizedAnswer.length >= 8 && optionText.length >= 8 && (normalizedAnswer.includes(optionText) || optionText.includes(normalizedAnswer));
  });
  if (contained.length === 1) return { label: contained[0].label, strategy: "answer_text_contains", answerBefore: answer };
  return null;
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function loadDbQuestions(sql) {
  const rows = await sql.query(`
    SELECT q.*, qe.id AS explanation_id, qe.answer, qe.explanation_short, qe.rationale, qe.source_chunk_ids,
           qe.evidence_status, qe.confidence, qe.warnings, qe.model, qe.needs_human_review
    FROM questions q
    LEFT JOIN question_explanations qe ON qe.question_id = q.id
    WHERE q.is_active = true
    ORDER BY q.id
  `);
  const ids = rows.map((row) => row.id);
  const optionRows = ids.length ? await sql.query("SELECT * FROM question_options WHERE question_id = ANY($1::text[]) ORDER BY question_id, label", [ids]) : [];
  const topicRows = ids.length ? await sql.query("SELECT * FROM question_topic_map WHERE question_id = ANY($1::text[])", [ids]) : [];
  const reportRows = ids.length ? await sql.query("SELECT * FROM card_reports WHERE question_id = ANY($1::text[]) AND status IN ('open', 'reviewing')", [ids]) : [];
  const byId = new Map(rows.map((row) => [String(row.id), {
    id: String(row.id),
    subject: row.subject,
    questionType: row.question_type,
    questionText: row.question_text,
    rawText: row.raw_text,
    needsReview: row.needs_review,
    needsTopicReview: row.needs_topic_review,
    reviewStatusId: row.review_status_id,
    reliabilityLevelId: row.reliability_level_id,
    publicationStatus: row.publication_status,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    adminNote: row.admin_note,
    isActive: row.is_active,
    options: [],
    topicIds: [],
    reports: [],
    explanation: row.explanation_id ? {
      id: row.explanation_id,
      answer: row.answer,
      explanationShort: row.explanation_short,
      rationale: row.rationale,
      sourceChunkIds: row.source_chunk_ids,
      evidenceStatus: row.evidence_status,
      confidence: row.confidence,
      warnings: row.warnings,
      model: row.model,
      needsHumanReview: row.needs_human_review,
    } : null,
  }]));
  for (const option of optionRows) byId.get(String(option.question_id))?.options.push({ id: option.id, label: option.label, text: option.text });
  for (const topic of topicRows) byId.get(String(topic.question_id))?.topicIds.push(String(topic.topic_id));
  for (const report of reportRows) byId.get(String(report.question_id))?.reports.push(report);
  return [...byId.values()];
}

function classify(question, ragById) {
  const row = ragById.get(question.id);
  const detected = detectOptions(question);
  const base = {
    questionId: question.id,
    publicationStatus: question.publicationStatus ?? "seed",
    questionType: question.questionType,
    reportIds: (question.reports ?? []).map((report) => report.id),
    reportReasons: (question.reports ?? []).map((report) => report.reason),
    evidenceStatus: row?.evidenceStatus ?? question.explanation?.evidenceStatus ?? "missing",
    warnings: [],
  };
  if (!detected) {
    return {
      ...base,
      bucket: "open_or_statement_card",
      action: question.publicationStatus === "published" ? "unpublish_true_open_card" : "needs_admin_review",
      reason: "no_reliable_sequential_options",
      proposedPatch: { publicationStatus: "needs_repair", reviewStatusId: "reviewing", needsReview: true },
    };
  }
  const mapped = mapAnswer(row, question.explanation, detected.options);
  if (!mapped) {
    return {
      ...base,
      bucket: "mcq_structure_repair_answer_ambiguous",
      action: "needs_admin_review",
      optionSource: detected.source,
      detectedOptions: detected.options,
      questionTextAfter: detected.questionText,
      answerBefore: row?.answer ?? question.explanation?.answer ?? "",
      reason: "answer_not_safely_mappable",
      proposedPatch: { publicationStatus: "needs_repair", reviewStatusId: "reviewing", needsReview: true },
    };
  }
  if ((row?.evidenceStatus ?? question.explanation?.evidenceStatus) !== "supported") {
    return {
      ...base,
      bucket: "mcq_evidence_unsupported",
      action: "needs_admin_review",
      optionSource: detected.source,
      detectedOptions: detected.options,
      answerBefore: mapped.answerBefore,
      answerAfter: mapped.label,
      mappingStrategy: mapped.strategy,
      reason: "evidence_not_supported",
      proposedPatch: { publicationStatus: "needs_repair", reviewStatusId: "reviewing", needsReview: true },
    };
  }
  return {
    ...base,
    bucket: "mcq_repair_auto",
    action: "repair_publish_mcq",
    optionSource: detected.source,
    questionTextBefore: question.questionText,
    questionTextAfter: detected.questionText,
    detectedOptions: detected.options.map((option) => ({
      id: existingOptions(question).find((old) => old.label === option.label)?.id ?? `${question.id}_opt_${option.label.toLowerCase()}`,
      questionId: question.id,
      label: option.label,
      text: option.text,
    })),
    answerBefore: mapped.answerBefore,
    answerAfter: mapped.label,
    mappingStrategy: mapped.strategy,
    questionTextHadMetadata: hasMetadata(question.questionText),
    sourceModel: row?.model ?? question.explanation?.model ?? "existing",
    proposedPatch: { publicationStatus: "published", reviewStatusId: "approved", reliabilityLevelId: "human_verified", needsReview: false },
  };
}

function snapshotHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function writeRollbackSnapshot(sql, questionId, rollbackStream) {
  const [question] = await sql.query("SELECT * FROM questions WHERE id = $1", [questionId]);
  const options = await sql.query("SELECT * FROM question_options WHERE question_id = $1 ORDER BY label", [questionId]);
  const [explanation] = await sql.query("SELECT * FROM question_explanations WHERE question_id = $1", [questionId]);
  const topics = await sql.query("SELECT * FROM question_topic_map WHERE question_id = $1", [questionId]);
  const reports = await sql.query("SELECT * FROM card_reports WHERE question_id = $1 AND status IN ('open', 'reviewing')", [questionId]);
  const snapshot = { questionId, question, options, explanation: explanation ?? null, topics, reports, createdAt: new Date().toISOString() };
  rollbackStream.write(`${JSON.stringify(snapshot)}\n`);
  return snapshot;
}

async function applyCandidate(sql, candidate, rollbackStream) {
  await sql.query("BEGIN");
  try {
    const before = await writeRollbackSnapshot(sql, candidate.questionId, rollbackStream);
    if (candidate.bucket === "mcq_repair_auto") {
      await sql.query(
        `UPDATE questions
         SET question_type = 'multiple_choice',
             question_text = $2,
             raw_text = $3,
             needs_review = false,
             needs_topic_review = false,
             review_status_id = 'approved',
             reliability_level_id = 'human_verified',
             publication_status = 'published',
             published_at = COALESCE(published_at, now()),
             published_by = 'question_repair_pipeline',
             admin_note = NULL
         WHERE id = $1`,
        [
          candidate.questionId,
          candidate.questionTextAfter,
          [candidate.questionTextAfter, ...candidate.detectedOptions.map((option) => `${option.label}. ${option.text}`)].join("\n"),
        ],
      );
      await sql.query("DELETE FROM question_options WHERE question_id = $1", [candidate.questionId]);
      for (const option of candidate.detectedOptions) {
        await sql.query(
          `INSERT INTO question_options (id, question_id, label, text)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, text = EXCLUDED.text`,
          [option.id, candidate.questionId, option.label, option.text],
        );
      }
      await sql.query(
        `UPDATE question_explanations
         SET answer = $2,
             evidence_status = 'supported',
             warnings = $3::jsonb,
             model = $4,
             needs_human_review = false
         WHERE question_id = $1`,
        [
          candidate.questionId,
          candidate.answerAfter,
          JSON.stringify([`question_repair_pipeline:${candidate.mappingStrategy}`]),
          `question_repair_pipeline+${candidate.sourceModel}`,
        ],
      );
      await sql.query(
        `UPDATE card_reports
         SET status = 'resolved', resolved_at = now(), resolved_by = 'question_repair_pipeline'
         WHERE question_id = $1 AND status IN ('open', 'reviewing')`,
        [candidate.questionId],
      );
    } else {
      await sql.query(
        `UPDATE questions
         SET publication_status = 'needs_repair',
             published_at = NULL,
             published_by = NULL,
             needs_review = true,
             review_status_id = 'reviewing',
             admin_note = $2
         WHERE id = $1`,
        [candidate.questionId, `question_repair_pipeline: ${candidate.bucket}; ${candidate.reason}`],
      );
      await sql.query("UPDATE question_explanations SET needs_human_review = true WHERE question_id = $1", [candidate.questionId]);
    }
    await sql.query(
      `INSERT INTO agent_review_logs (id, question_id, actor_user_id, action, patch, created_at)
       VALUES ($1, $2, 'question_repair_pipeline', 'question_db_repair_pipeline', $3::jsonb, now())`,
      [`agentlog_${crypto.randomUUID()}`, candidate.questionId, JSON.stringify({ bucket: candidate.bucket, action: candidate.action, beforeHash: snapshotHash(before), after: candidate })],
    );
    await sql.query("COMMIT");
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}

async function restoreRollback(sql, file) {
  const snapshots = readJsonl(path.resolve(process.cwd(), file));
  for (const snapshot of snapshots) {
    await sql.query("BEGIN");
    try {
      const q = snapshot.question;
      await sql.query(
        `UPDATE questions SET subject = $2, question_type = $3, question_text = $4, source_refs = $5::jsonb,
           exam_date = $6, needs_review = $7, raw_text = $8, needs_topic_review = $9, review_status_id = $10,
           reliability_level_id = $11, publication_status = $12, published_at = $13, published_by = $14,
           admin_note = $15, is_active = $16 WHERE id = $1`,
        [q.id, q.subject, q.question_type, q.question_text, JSON.stringify(q.source_refs), q.exam_date, q.needs_review, q.raw_text, q.needs_topic_review, q.review_status_id, q.reliability_level_id, q.publication_status, q.published_at, q.published_by, q.admin_note, q.is_active],
      );
      await sql.query("DELETE FROM question_options WHERE question_id = $1", [snapshot.questionId]);
      for (const option of snapshot.options) {
        await sql.query("INSERT INTO question_options (id, question_id, label, text) VALUES ($1, $2, $3, $4)", [option.id, option.question_id, option.label, option.text]);
      }
      await sql.query("DELETE FROM question_topic_map WHERE question_id = $1", [snapshot.questionId]);
      for (const topic of snapshot.topics) {
        await sql.query("INSERT INTO question_topic_map (question_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [topic.question_id, topic.topic_id]);
      }
      if (snapshot.explanation) {
        const e = snapshot.explanation;
        await sql.query(
          `INSERT INTO question_explanations (id, question_id, answer, explanation_short, rationale, source_chunk_ids, external_source_urls, external_sources, evidence_status, confidence, warnings, model, needs_human_review)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12,$13)
           ON CONFLICT (question_id) DO UPDATE SET answer = EXCLUDED.answer, explanation_short = EXCLUDED.explanation_short,
           rationale = EXCLUDED.rationale, source_chunk_ids = EXCLUDED.source_chunk_ids, external_source_urls = EXCLUDED.external_source_urls,
           external_sources = EXCLUDED.external_sources, evidence_status = EXCLUDED.evidence_status, confidence = EXCLUDED.confidence,
           warnings = EXCLUDED.warnings, model = EXCLUDED.model, needs_human_review = EXCLUDED.needs_human_review`,
          [e.id, e.question_id, e.answer, e.explanation_short, e.rationale, JSON.stringify(e.source_chunk_ids ?? []), JSON.stringify(e.external_source_urls ?? []), JSON.stringify(e.external_sources ?? []), e.evidence_status, e.confidence, JSON.stringify(e.warnings ?? []), e.model, e.needs_human_review],
        );
      }
      for (const report of snapshot.reports) {
        await sql.query("UPDATE card_reports SET status = $2, resolved_at = $3, resolved_by = $4 WHERE id = $1", [report.id, report.status, report.resolved_at, report.resolved_by]);
      }
      await sql.query("COMMIT");
    } catch (error) {
      await sql.query("ROLLBACK");
      throw error;
    }
  }
  return snapshots.length;
}

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
fs.mkdirSync(outDir, { recursive: true });

if (rollbackFile) {
  const restored = await restoreRollback(sql, rollbackFile);
  const rollbackReportPath = path.join(outDir, "question_repair_rollback_report.md");
  fs.writeFileSync(rollbackReportPath, `# Question repair rollback\n\n- Restored snapshots: ${restored}\n- Rollback file: \`${rollbackFile}\`\n`);
  console.log(JSON.stringify({ mode: "rollback", restored, rollbackReportPath }, null, 2));
  process.exit(0);
}

const seedPath = path.resolve(process.cwd(), "data/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const ragById = new Map(readJsonl(artifact).map((row) => [String(row.questionId), row]));
let questions = sql ? await loadDbQuestions(sql) : seed.questions.map((question) => ({ ...question, publicationStatus: "seed", reports: [], explanation: null }));
questions = questions.filter((question) => (questionIds.size ? questionIds.has(question.id) : true));
questions = questions.filter((question) => (fromReports ? (question.reports ?? []).length > 0 : true));
questions = questions.filter((question) => (
  questionIds.size || fromReports || !["rejected", "not_recoverable"].includes(question.publicationStatus)
));
questions = questions.filter((question) => (excludePublished && !includePublished ? question.publicationStatus !== "published" : true));

let rows = candidateFile ? readJsonl(path.resolve(process.cwd(), candidateFile)) : questions.map((question) => classify(question, ragById));
const candidates = rows.filter((row) => row.bucket === "mcq_repair_auto");
const needsReview = rows.filter((row) => row.bucket !== "mcq_repair_auto" && row.action !== "reject");
const rejected = rows.filter((row) => row.action === "reject");

const candidatesPath = path.join(outDir, "question_repair_candidates.jsonl");
const needsReviewPath = path.join(outDir, "question_repair_needs_review.jsonl");
const rejectedPath = path.join(outDir, "question_repair_rejected.jsonl");
const summaryPath = path.join(outDir, "question_repair_summary.json");
const reportPath = path.join(outDir, "question_repair_report.md");
fs.writeFileSync(candidatesPath, candidates.map((row) => JSON.stringify(row)).join("\n") + (candidates.length ? "\n" : ""));
fs.writeFileSync(needsReviewPath, needsReview.map((row) => JSON.stringify(row)).join("\n") + (needsReview.length ? "\n" : ""));
fs.writeFileSync(rejectedPath, rejected.map((row) => JSON.stringify(row)).join("\n") + (rejected.length ? "\n" : ""));

const bucketCounts = rows.reduce((acc, row) => ({ ...acc, [row.bucket]: (acc[row.bucket] ?? 0) + 1 }), {});
const mappingCounts = candidates.reduce((acc, row) => ({ ...acc, [row.mappingStrategy]: (acc[row.mappingStrategy] ?? 0) + 1 }), {});
const summary = {
  mode: apply ? "apply" : "dry-run",
  source: sql ? "database" : "seed",
  artifact: path.relative(process.cwd(), artifact),
  candidateFile: candidateFile ?? null,
  totalScanned: rows.length,
  bucketCounts,
  mappingCounts,
  outputFiles: { candidatesPath, needsReviewPath, rejectedPath, summaryPath, reportPath },
};
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

let applied = 0;
let rollbackPath = null;
if (apply) {
  rollbackPath = path.join(outDir, `question_repair_rollback_${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
  const rollbackStream = fs.createWriteStream(rollbackPath, { flags: "wx" });
  for (const row of rows) {
    if (row.bucket === "mcq_repair_auto" || row.action === "unpublish_true_open_card" || row.action === "needs_admin_review") {
      await applyCandidate(sql, row, rollbackStream);
      applied += 1;
    }
  }
  rollbackStream.end();
}

fs.writeFileSync(
  reportPath,
  [
    "# Question repair report",
    "",
    `Mode: ${summary.mode}`,
    `Source: ${summary.source}`,
    `Artifact: \`${summary.artifact}\``,
    `Scanned rows: ${rows.length}`,
    `Applied rows: ${applied}`,
    rollbackPath ? `Rollback snapshot: \`${rollbackPath}\`` : "Rollback snapshot: not written in dry-run",
    "",
    "## Buckets",
    "",
    ...Object.entries(bucketCounts).sort((a, b) => b[1] - a[1]).map(([bucket, count]) => `- ${bucket}: ${count}`),
    "",
    "## Mapping Strategies",
    "",
    ...Object.entries(mappingCounts).sort((a, b) => b[1] - a[1]).map(([strategy, count]) => `- ${strategy}: ${count}`),
    "",
    "## Policy",
    "",
    "Deterministic extraction accepts sequential A-F options with 2-6 options. It does not generate distractors.",
    "True open-answer or statement cards are moved to needs_repair in apply mode and must not remain public.",
    "DeepSeek classification is not invoked by this script unless a future explicit implementation is added.",
    "",
  ].join("\n"),
);

console.log(JSON.stringify({ ...summary, applied, rollbackPath }, null, 2));
