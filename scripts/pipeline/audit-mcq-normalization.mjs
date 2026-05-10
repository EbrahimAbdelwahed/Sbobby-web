#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import {
  normalizeText,
  parseArgs,
  resolveRepoPath,
} from "./pipeline-utils.mjs";

const args = parseArgs(process.argv.slice(2));

const seedPath = resolveRepoPath(String(args.seed ?? "data/seed.json"));
const parsedPath = resolveRepoPath(
  String(args.parsed ?? "data/pipeline/exam_questions_embedded_options_parsed.jsonl"),
);
const answersPath = resolveRepoPath(
  String(
    args.answers ??
      "data/pipeline/rag_answers_684_top12_partial_plus_grep_all_hard_residual60_pageindex_grep_parsedopts4_windowjudge15_reconciled.jsonl",
  ),
);
const outJsonPath = resolveRepoPath(
  String(args.outJson ?? "data/pipeline/normalization/mcq_normalization_audit.json"),
);
const outMdPath = resolveRepoPath(
  String(args.outMd ?? "data/pipeline/normalization/mcq_normalization_audit.md"),
);

function loadJsonl(raw) {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

function extractAnswerLabel(answer) {
  const text = String(answer ?? "").trim();
  if (!text) return null;

  const match =
    text.match(/^(?:opzione|option|scelta)?\s*([A-F])(?:\b|[\)\].:\-])/i) ??
    text.match(/^([A-F])(?:\b|[\)\].:\-])/i) ??
    text.match(/^([A-F])$/i);

  return match ? match[1].toUpperCase() : null;
}

function isMetadataContaminated(question) {
  const rawText = String(question?.rawText ?? "");
  const questionText = String(question?.questionText ?? "");
  const patterns = [
    /\bSBOBINATORE\b/i,
    /\bREVISORE\b/i,
    /\bQUIZ LEZIONI\b/i,
    /\bPROF\.?SSA\b/i,
    /\bPROF\.?\b/i,
    /\bL\d{1,3}[_-]\d{2}\.\d{2}\.\d{4}\b/i,
    /_{10,}/,
    /\bSBOBINATORE_[A-Z]+/i,
  ];

  return patterns.some((pattern) => pattern.test(rawText) || pattern.test(questionText));
}

function compact(text, max = 160) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

const [seedRaw, parsedRaw, answersRaw] = await Promise.all([
  readFile(seedPath, "utf8"),
  readFile(parsedPath, "utf8"),
  readFile(answersPath, "utf8"),
]);

const seed = JSON.parse(seedRaw);
const parsedQuestions = loadJsonl(parsedRaw);
const answers = loadJsonl(answersRaw);

const seedQuestions = Array.isArray(seed.questions) ? seed.questions : [];
const answersByQuestionId = new Map(answers.map((row) => [row.questionId, row]));

const explicitSeedQuestions = seedQuestions.filter(
  (question) => Array.isArray(question.options) && question.options.length > 0,
);
const parsedSelectableQuestions = parsedQuestions.filter(
  (question) => Array.isArray(question.options) && question.options.length > 0,
);
const parsedEmbeddedQuestions = parsedQuestions.filter(
  (question) => question.questionType === "open" && question.embeddedOptionsParsed,
);
const contaminationRows = parsedQuestions.filter(isMetadataContaminated);

const answerMappedQuestions = [];
const answerMappedExplicitQuestions = [];
const answerMappedParsedQuestions = [];
const unresolvedWithOptions = [];

for (const question of parsedSelectableQuestions) {
  const answerRow = answersByQuestionId.get(question.id);
  const answerLabel = extractAnswerLabel(answerRow?.answer);
  const matchedOption = answerLabel
    ? question.options.find((option) => normalizeText(option.label) === normalizeText(answerLabel))
    : null;

  if (matchedOption) {
    answerMappedQuestions.push({
      questionId: question.id,
      answer: answerRow?.answer ?? "",
      answerLabel,
      mappedOptionLabel: matchedOption.label,
      questionType: question.questionType,
      embeddedOptionsParsed: Boolean(question.embeddedOptionsParsed),
      questionText: question.questionText ?? "",
    });
    if (question.questionType === "multiple_choice") {
      answerMappedExplicitQuestions.push(question.id);
    } else if (question.questionType === "open" && question.embeddedOptionsParsed) {
      answerMappedParsedQuestions.push(question.id);
    }
    continue;
  }

  unresolvedWithOptions.push({
    questionId: question.id,
    answer: answerRow?.answer ?? "",
    questionType: question.questionType,
    embeddedOptionsParsed: Boolean(question.embeddedOptionsParsed),
    questionText: question.questionText ?? "",
  });
}

const counts = {
  totalQuestions: parsedQuestions.length,
  seedExplicitOptions: explicitSeedQuestions.length,
  parsedSelectableQuestions: parsedSelectableQuestions.length,
  parsedExplicitMultipleChoice: parsedSelectableQuestions.filter(
    (question) => question.questionType === "multiple_choice",
  ).length,
  parsedEmbeddedOpenQuestions: parsedEmbeddedQuestions.length,
  answerLabelMappedQuestions: answerMappedQuestions.length,
  answerLabelMappedExplicitQuestions: answerMappedExplicitQuestions.length,
  answerLabelMappedParsedQuestions: answerMappedParsedQuestions.length,
  unresolvedSelectableQuestions: unresolvedWithOptions.length,
  metadataContaminatedQuestions: contaminationRows.length,
};

const report = {
  sources: {
    seedPath,
    parsedPath,
    answersPath,
  },
  counts,
  deterministicRules: [
    "Keep only rows with options already present or extracted from embedded option lines.",
    "Map answers only when the answer string yields a standalone label A-F and the label matches an existing option label after normalization.",
    "Do not infer answers from prose, explanation text, or source evidence.",
    "Flag metadata contamination only when the row contains explicit speaker / editor / timestamp / separator artifacts in raw text or question text.",
  ],
  metadataContaminatedQuestionIds: contaminationRows.map((row) => row.id),
  metadataContaminatedExamples: contaminationRows.map((row) => ({
    id: row.id,
    questionText: row.questionText ?? "",
    rawText: compact(row.rawText ?? ""),
  })),
  answerMappedQuestionIds: answerMappedQuestions.map((row) => row.questionId),
  answerMappedExamples: answerMappedQuestions.slice(0, 20),
  unresolvedSelectableQuestionIds: unresolvedWithOptions.map((row) => row.questionId),
  unresolvedSelectableExamples: unresolvedWithOptions.slice(0, 20),
  seedQuestionsWithExplicitOptions: explicitSeedQuestions.map((row) => row.id),
  parsedSelectableQuestionIds: parsedSelectableQuestions.map((row) => row.id),
  parsedEmbeddedQuestionIds: parsedEmbeddedQuestions.map((row) => row.id),
};

await writeFile(outJsonPath, `${JSON.stringify(report, null, 2)}\n`);

const markdown = [
  "# MCQ Normalization Audit",
  "",
  "## Sources",
  "",
  `- Seed: ${seedPath}`,
  `- Parsed embedded options: ${parsedPath}`,
  `- Windowjudge15 answers: ${answersPath}`,
  "",
  "## Counts",
  "",
  `- Total questions: ${counts.totalQuestions}`,
  `- Seed questions already carrying explicit options: ${counts.seedExplicitOptions}`,
  `- Questions selectable as MCQ after embedded parsing: ${counts.parsedSelectableQuestions}`,
  `-  of which explicit multiple_choice: ${counts.parsedExplicitMultipleChoice}`,
  `-  of which open but parsed into options: ${counts.parsedEmbeddedOpenQuestions}`,
  `- Answers deterministically mappable to an option label: ${counts.answerLabelMappedQuestions}`,
  `-  explicit multiple_choice mapped: ${counts.answerLabelMappedExplicitQuestions}`,
  `-  open parsed mapped: ${counts.answerLabelMappedParsedQuestions}`,
  `- Selectable questions still unresolved by label mapping: ${counts.unresolvedSelectableQuestions}`,
  `- Metadata-contaminated questions: ${counts.metadataContaminatedQuestions}`,
  "",
  "## Deterministic Rules",
  "",
  ...report.deterministicRules.map((rule) => `- ${rule}`),
  "",
  "## Contamination",
  "",
  ...(report.metadataContaminatedExamples.length
    ? report.metadataContaminatedExamples.map(
        (row) => `- ${row.id}: ${row.questionText}${row.rawText ? ` | ${row.rawText}` : ""}`,
      )
    : ["- None"]),
  "",
  "## Unresolved Selectable Questions",
  "",
  ...(report.unresolvedSelectableExamples.length
    ? report.unresolvedSelectableExamples.map((row) => {
        const prefix = row.embeddedOptionsParsed ? "parsed-open" : "explicit-mcq";
        return `- ${row.questionId} (${prefix}): ${compact(row.questionText, 120)}${row.answer ? ` | answer: ${compact(row.answer, 120)}` : ""}`;
      })
    : ["- None"]),
];

await writeFile(outMdPath, `${markdown.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      outJsonPath,
      outMdPath,
      counts,
    },
    null,
    2,
  ),
);
