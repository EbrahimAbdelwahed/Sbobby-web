#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const PROMPT_VERSION = "anatomy-mcq-deepseek-repair-v1";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_OUT_DIR = "data/pipeline/anatomy-mcq-deepseek-repair";
const knownAmbiguousQuestionIds = new Set([
  // Duplicate/near-duplicate plesso lombosacrale item: DeepSeek alternated between
  // safe and ambiguous classifications across dry-runs, so it needs human review.
  "q_49bf57dd441e",
]);

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

function readJsonl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

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
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripFence(value) {
  let text = String(value ?? "").trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();
  return text;
}

function parseJsonObject(value) {
  const text = stripFence(value);
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("DeepSeek response did not contain a JSON object");
  }
}

function laterOptionMarker(label, text) {
  const labels = "ABCDEF";
  const start = labels.indexOf(label) + 1;
  if (start <= 0) return null;
  const pattern = new RegExp(`(?:^|\\s|\\n)([${labels.slice(start)}])[\\).:-]\\s+`, "i");
  return String(text ?? "").match(pattern)?.[1]?.toUpperCase() ?? null;
}

function tokenSet(value) {
  return new Set(
    normalizeText(value)
      .replace(/[^a-z0-9àèéìòùç]+/gi, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function overlapRatio(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.min(left.size, right.size);
}

function extractRawOptionLabels(text) {
  return [...String(text ?? "").matchAll(/(?:^|\n|\s)([A-Fa-f])[\).:-]\s+/g)].map((match) => match[1].toUpperCase());
}

function validateRepair(row, repair) {
  const errors = [];
  const questionText = cleanupText(repair.questionText);
  const options = Array.isArray(repair.options) ? repair.options : [];
  const answerLabel = normalizeLabel(repair.answerLabel);
  const confidence = Number(repair.confidence);
  const ambiguity = Boolean(repair.ambiguous);

  if (knownAmbiguousQuestionIds.has(row.id)) errors.push("known_ambiguous_question");
  if (ambiguity) errors.push("model_marked_ambiguous");
  if (!["supported", "externally_supported"].includes(String(row.evidence_status ?? ""))) errors.push("evidence_not_publishable");
  if (!Number.isFinite(confidence) || confidence < 0.9) errors.push("low_confidence");
  if (!questionText || questionText.length < 8) errors.push("missing_question_text");
  if (options.length < 2 || options.length > 6) errors.push("bad_option_count");

  const normalizedOptions = options.map((option) => ({
    label: normalizeLabel(option?.label),
    text: cleanupText(option?.text),
  }));
  const labels = normalizedOptions.map((option) => option.label).join("");
  if (labels !== "ABCDEF".slice(0, normalizedOptions.length)) errors.push("non_sequential_labels");
  if (!normalizedOptions.some((option) => option.label === answerLabel)) errors.push("answer_not_in_options");
  if (!/^[A-F]$/.test(answerLabel)) errors.push("answer_not_single_label");

  const seenTexts = new Set();
  for (const option of normalizedOptions) {
    if (!option.label || !option.text || option.text.length < 1) errors.push(`empty_option_${option.label || "unknown"}`);
    const textKey = normalizeText(option.text);
    if (seenTexts.has(textKey)) errors.push(`duplicate_option_${option.label}`);
    seenTexts.add(textKey);
    const laterMarker = laterOptionMarker(option.label, option.text);
    if (laterMarker) errors.push(`option_${option.label}_contains_later_marker_${laterMarker}`);
    if (normalizeText(option.text) === normalizeText(questionText)) errors.push(`option_${option.label}_duplicates_question`);
  }

  const rawLabels = extractRawOptionLabels(row.raw_text);
  if (rawLabels.length >= 2 && rawLabels.length <= 6) {
    const rawSequence = rawLabels.join("");
    if (rawSequence === "ABCDEF".slice(0, rawLabels.length) && rawLabels.length !== normalizedOptions.length) {
      errors.push("option_count_drift_from_raw");
    }
  }

  const sourceText = [row.question_text, row.raw_text].join("\n");
  if (overlapRatio(questionText, sourceText) < 0.45) errors.push("question_semantic_drift");
  for (const option of normalizedOptions) {
    const semanticTokens = tokenSet(option.text);
    if (semanticTokens.size > 0 && overlapRatio(option.text, sourceText) < 0.35) {
      errors.push(`option_${option.label}_semantic_drift`);
    }
  }

  const existingAnswer = String(row.answer ?? "").trim();
  if (/^[A-F]$/i.test(existingAnswer) && answerLabel !== existingAnswer.toUpperCase()) {
    errors.push("answer_changed_from_single_label");
  }
  if (/\b[A-F]\s*(?:e|,|\/|\+)\s*[A-F]\b/i.test(existingAnswer)) {
    errors.push("existing_answer_is_multi_label");
  }

  return {
    accepted: errors.length === 0,
    errors,
    normalized: {
      questionText,
      options: normalizedOptions,
      answerLabel,
      confidence,
      rationale: cleanupText(repair.rationale),
    },
  };
}

function buildPrompt(row) {
  const existingOptions = (row.options ?? []).map((option) => `${option.label}. ${option.text}`).join("\n");
  return [
    "You repair malformed Italian medical multiple-choice cards extracted by OCR.",
    "Use only the supplied question text/raw text/options/answer. Do not invent new distractors or medical facts.",
    "Return JSON only with this schema:",
    '{"questionText":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."}],"answerLabel":"A","ambiguous":false,"confidence":0.0,"rationale":"..."}',
    "Rules:",
    "- Clean obvious OCR spacing/letter corruption only when the intended text is clear.",
    "- Preserve the medical meaning.",
    "- Options must be sequential A, B, C... with 2 to 6 options.",
    "- answerLabel must be exactly one label from the options.",
    "- If the source implies multiple correct labels, missing options, unclear answer, or semantic uncertainty, set ambiguous=true and keep confidence below 0.82.",
    "- Do not include explanations or source citations.",
    "",
    `Question ID: ${row.id}`,
    `Current answer: ${row.answer ?? ""}`,
    `Evidence status: ${row.evidence_status ?? ""}`,
    `Question text:\n${row.question_text ?? ""}`,
    existingOptions ? `Existing options:\n${existingOptions}` : "Existing options: none",
    `Raw text:\n${row.raw_text ?? ""}`,
  ].join("\n");
}

async function fetchWithRetry(url, init, label, retries) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(`${label} fetch failed after ${retries} attempts: ${lastError?.message ?? lastError}`);
}

async function callDeepSeek(row, { endpoint, apiKey, model, retries }) {
  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a conservative data-repair assistant. Return valid JSON only.",
        },
        { role: "user", content: buildPrompt(row) },
      ],
    }),
  }, `DeepSeek repair ${row.id}`, retries);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`DeepSeek repair failed (${response.status}): ${body.slice(0, 800)}`);
  }
  const payload = JSON.parse(body);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek response did not include content");
  return { model: payload.model ?? model, rawContent: content, parsed: parseJsonObject(content) };
}

async function snapshotQuestion(sql, questionId) {
  const [question] = await sql.query("SELECT * FROM questions WHERE id = $1", [questionId]);
  const options = await sql.query("SELECT * FROM question_options WHERE question_id = $1 ORDER BY label", [questionId]);
  const [explanation] = await sql.query("SELECT * FROM question_explanations WHERE question_id = $1", [questionId]);
  const topics = await sql.query("SELECT * FROM question_topic_map WHERE question_id = $1 ORDER BY topic_id", [questionId]);
  const reports = await sql.query("SELECT * FROM card_reports WHERE question_id = $1 ORDER BY created_at", [questionId]);
  return { questionId, question, options, explanation: explanation ?? null, topics, reports, createdAt: new Date().toISOString() };
}

async function applyRepair(sql, row, result, rollbackStream) {
  const repair = result.normalized ?? result.repair;
  if (!repair) throw new Error("repair payload is missing");
  rollbackStream.write(`${JSON.stringify(await snapshotQuestion(sql, row.id))}\n`);
  const rawText = [repair.questionText, ...repair.options.map((option) => `${option.label}. ${option.text}`)].join("\n");
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
         published_by = 'anatomy_mcq_deepseek_repair',
         admin_note = NULL
     WHERE id = $1`,
    [row.id, repair.questionText, rawText],
  );
  await sql.query("DELETE FROM question_options WHERE question_id = $1", [row.id]);
  for (const option of repair.options) {
    await sql.query(
      `INSERT INTO question_options (id, question_id, label, text)
       VALUES ($1, $2, $3, $4)`,
      [`${row.id}_opt_${option.label.toLowerCase()}`, row.id, option.label, option.text],
    );
  }
  await sql.query(
    `UPDATE question_explanations
     SET answer = $2,
         evidence_status = CASE
           WHEN evidence_status IN ('supported', 'externally_supported') THEN evidence_status
           ELSE 'supported'
         END,
         warnings = $3::jsonb,
         model = $4,
         needs_human_review = false
     WHERE question_id = $1`,
    [
      row.id,
      repair.answerLabel,
      JSON.stringify([`anatomy_mcq_deepseek_repair:${PROMPT_VERSION}`]),
      `anatomy_mcq_deepseek_repair+${result.model}`,
    ],
  );
  await sql.query(
    `UPDATE card_reports
     SET status = 'resolved', resolved_at = now(), resolved_by = 'anatomy_mcq_deepseek_repair'
     WHERE question_id = $1 AND status IN ('open', 'reviewing')`,
    [row.id],
  );
  await sql.query(
    `INSERT INTO agent_review_logs (id, question_id, actor_user_id, action, patch, created_at)
     VALUES ($1, $2, 'anatomy_mcq_deepseek_repair', 'anatomy_mcq_deepseek_repair', $3::jsonb, now())`,
    [
      `arl_${crypto.randomBytes(8).toString("hex")}`,
      row.id,
      JSON.stringify({
        promptVersion: PROMPT_VERSION,
        model: result.model,
        confidence: repair.confidence,
        answerLabel: repair.answerLabel,
        optionCount: repair.options.length,
        rationale: repair.rationale,
      }),
    ],
  );
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const limit = args.limit == null ? null : Number.parseInt(String(args.limit), 10);
  const offset = Number.parseInt(String(args.offset ?? "0"), 10);
  const outDir = path.resolve(process.cwd(), String(args["out-dir"] ?? DEFAULT_OUT_DIR));
  const model = String(args.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL);
  const endpoint = process.env.DEEPSEEK_API_BASE_URL ?? "https://api.deepseek.com/chat/completions";
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const retries = Number.parseInt(String(args["fetch-retries"] ?? "3"), 10);
  const candidateFiles = String(args["candidate-file"] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(process.cwd(), item));

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (candidateFiles.length === 0 && !apiKey) throw new Error("DEEPSEEK_API_KEY is required");
  if (!Number.isFinite(offset) || offset < 0) throw new Error("--offset must be a non-negative integer");
  if (limit != null && (!Number.isFinite(limit) || limit < 0)) throw new Error("--limit must be a non-negative integer");

  fs.mkdirSync(outDir, { recursive: true });
  const sql = neon(process.env.DATABASE_URL);
  const candidateRows = candidateFiles.flatMap((filePath) => readJsonl(filePath));
  const candidateIds = [...new Set(candidateRows.map((row) => row.questionId).filter(Boolean))];
  const candidateById = new Map(candidateRows.map((row) => [row.questionId, row]));
  const candidateWhere = candidateIds.length > 0 ? `AND q.id = ANY($${limit == null ? 2 : 3}::text[])` : "";
  const rows = await sql.query(
    `SELECT
       q.id,
       q.question_text,
       q.raw_text,
       q.program_eligibility_reason,
       qe.answer,
       qe.evidence_status,
       qe.confidence,
       COALESCE(
         json_agg(json_build_object('label', qo.label, 'text', qo.text) ORDER BY qo.label)
           FILTER (WHERE qo.id IS NOT NULL),
         '[]'::json
       ) AS options
     FROM questions q
     JOIN question_topic_map qtm ON qtm.question_id = q.id
     JOIN topics t ON t.id = qtm.topic_id
     LEFT JOIN question_explanations qe ON qe.question_id = q.id
     LEFT JOIN question_options qo ON qo.question_id = q.id
     WHERE t.subject = 'anatomia'
       AND q.is_active = true
       AND q.question_type = 'multiple_choice'
       AND q.publication_status = 'needs_repair'
       ${candidateWhere}
     GROUP BY q.id, qe.answer, qe.evidence_status, qe.confidence
     ORDER BY q.id
     OFFSET $1
     ${limit == null ? "" : "LIMIT $2"}`,
    candidateIds.length > 0
      ? (limit == null ? [offset, candidateIds] : [offset, limit, candidateIds])
      : (limit == null ? [offset] : [offset, limit]),
  );

  const acceptedPath = path.join(outDir, "accepted.jsonl");
  const rejectedPath = path.join(outDir, "rejected.jsonl");
  const errorsPath = path.join(outDir, "errors.jsonl");
  const summaryPath = path.join(outDir, "summary.json");
  const reportPath = path.join(outDir, "report.md");
  const rollbackPath = apply ? path.join(outDir, `rollback_${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`) : null;
  for (const file of [acceptedPath, rejectedPath, errorsPath, summaryPath, reportPath]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const rollbackStream = rollbackPath ? fs.createWriteStream(rollbackPath, { flags: "wx" }) : null;
  const summary = {
    mode: apply ? "apply" : "dry-run",
    promptVersion: PROMPT_VERSION,
    model,
    source: candidateFiles.length > 0 ? "candidate-file" : "deepseek-live",
    candidateFiles,
    scanned: rows.length,
    accepted: 0,
    rejected: 0,
    errored: 0,
    applied: 0,
    rejectReasons: {},
    rollbackPath,
  };

  try {
    for (const row of rows) {
      try {
        const candidate = candidateById.get(row.id);
        const deepseek = candidate
          ? {
              model: candidate.model ?? model,
              rawContent: JSON.stringify(candidate.rawModelOutput ?? candidate.repair ?? {}),
              parsed: candidate.rawModelOutput ?? candidate.repair,
            }
          : await callDeepSeek(row, { endpoint, apiKey, model, retries });
        const validation = validateRepair(row, deepseek.parsed);
        const output = {
          questionId: row.id,
          accepted: validation.accepted,
          validationErrors: validation.errors,
          model: deepseek.model,
          promptVersion: PROMPT_VERSION,
          input: {
            answer: row.answer,
            evidenceStatus: row.evidence_status,
            programEligibilityReason: row.program_eligibility_reason,
            questionText: row.question_text,
            rawText: row.raw_text,
          },
          repair: validation.normalized,
          rawModelOutput: deepseek.parsed,
        };
        if (validation.accepted) {
          summary.accepted += 1;
          fs.appendFileSync(acceptedPath, `${JSON.stringify(output)}\n`);
          if (apply) {
            await applyRepair(sql, row, output, rollbackStream);
            summary.applied += 1;
          }
        } else {
          summary.rejected += 1;
          for (const error of validation.errors) summary.rejectReasons[error] = (summary.rejectReasons[error] ?? 0) + 1;
          fs.appendFileSync(rejectedPath, `${JSON.stringify(output)}\n`);
        }
        console.error(`[${summary.accepted + summary.rejected + summary.errored}/${summary.scanned}] ${row.id} ${validation.accepted ? "accepted" : `rejected:${validation.errors.join(",")}`}`);
      } catch (error) {
        summary.errored += 1;
        fs.appendFileSync(errorsPath, `${JSON.stringify({ questionId: row.id, error: error.message })}\n`);
        console.error(`[${summary.accepted + summary.rejected + summary.errored}/${summary.scanned}] ${row.id} error:${error.message}`);
      }
    }
  } finally {
    if (rollbackStream) rollbackStream.end();
  }

  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(reportPath, [
    "# Anatomy MCQ DeepSeek repair",
    "",
    `- Mode: ${summary.mode}`,
    `- Prompt version: ${PROMPT_VERSION}`,
    `- Model: ${model}`,
    `- Scanned: ${summary.scanned}`,
    `- Accepted: ${summary.accepted}`,
    `- Rejected: ${summary.rejected}`,
    `- Errored: ${summary.errored}`,
    `- Applied: ${summary.applied}`,
    `- Rollback: ${rollbackPath ?? "n/a"}`,
    "",
    "## Reject reasons",
    "",
    ...Object.entries(summary.rejectReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => `- ${reason}: ${count}`),
    "",
  ].join("\n"));
  console.log(JSON.stringify(summary, null, 2));
}

await main();
